import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@preorderflow/database";
import { nextAvailableSlug, slugifyName } from "../../common/slug";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";
import { assertCanAddPhoto, ProductPhotoLimitError } from "./product-photos";

// Variantes (couleurs) d'un produit, avec leur couleur pour l'affichage.
const VARIANTS_INCLUDE = { include: { color: true }, orderBy: { sku: "asc" } } as const;

// Photos d'un produit, dans l'ordre de la galerie (la première est la principale).
const PHOTOS_INCLUDE = { orderBy: { position: "asc" } } as const;

// « Rouge vif » -> « ROUGE-VIF » : suffixe de SKU sans accents ni espaces.
function skuSuffix(colorName: string): string {
  return slugifyName(colorName).toUpperCase();
}

@Injectable()
export class ProductService {
  async list() {
    return prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { variants: VARIANTS_INCLUDE, photos: PHOTOS_INCLUDE },
    });
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: VARIANTS_INCLUDE, photos: PHOTOS_INCLUDE },
    });
    if (!product) {
      throw new NotFoundException(`Produit "${id}" introuvable`);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    return prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug: await this.generateSlug(dto.slug?.trim() || dto.name),
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        taxRate: dto.taxRate,
        weight: dto.weight,
        documentUrl: dto.documentUrl,
        // Invariant : tout produit a une variante active. Sans couleur, c'est
        // la variante Standard, qui reprend le SKU du produit.
        variants: { create: [{ sku: dto.sku }] },
      },
      include: { variants: VARIANTS_INCLUDE },
    });
  }

  // Le slug n'est pas saisi : il découle du nom (ou d'une valeur fournie) et
  // reste unique grâce à un suffixe -2, -3… en cas de doublon.
  private async generateSlug(source: string): Promise<string> {
    const base = slugifyName(source) || "produit";
    const existing = await prisma.product.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return nextAvailableSlug(
      base,
      existing.map((product) => product.slug),
    );
  }

  // Nombre de lignes qui référencent la variante : mouvements de stock,
  // commandes, lots de production, intérêts de recensement. Tant qu'il y en a,
  // elle porte de l'historique et ne peut pas disparaître.
  private async variantReferenceCount(
    tx: Prisma.TransactionClient,
    variantId: string,
  ): Promise<number> {
    const counts = await Promise.all([
      tx.inventoryMovement.count({ where: { variantId } }),
      tx.orderItem.count({ where: { variantId } }),
      tx.productionItem.count({ where: { variantId } }),
      tx.campaignInterestItem.count({ where: { variantId } }),
    ]);
    return counts.reduce((sum, count) => sum + count, 0);
  }

  // Ajoute une couleur de la palette au produit. La variante Standard (sans
  // couleur) est retirée si rien ne la référence encore : un produit « Stylo »
  // devient « Stylo Rouge / Bleu », pas « Stylo + Rouge ».
  async addVariant(productId: string, colorId: string) {
    const product = await this.getById(productId);
    const color = await prisma.color.findUnique({ where: { id: colorId } });
    if (!color || !color.active) {
      throw new BadRequestException("Couleur introuvable ou inactive");
    }
    if (product.variants.some((variant) => variant.colorId === colorId)) {
      throw new BadRequestException(`Ce produit a déjà une variante "${color.name}"`);
    }

    const sku = `${product.sku}-${skuSuffix(color.name)}`;
    if (await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } })) {
      throw new BadRequestException(`Le SKU "${sku}" existe déjà`);
    }

    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: { productId, colorId, sku },
        include: { color: true },
      });

      const standard = product.variants.find((v) => v.colorId === null);
      if (standard && (await this.variantReferenceCount(tx, standard.id)) === 0) {
        await tx.productVariant.delete({ where: { id: standard.id } });
      }
      return variant;
    });
  }

  // Désactiver une couleur la retire : la variante est supprimée si elle ne
  // porte aucun historique (stock, réservé et disponible nuls, et aucune
  // commande, lot ou intérêt). Sinon elle reste, marquée inactive.
  //
  // Un produit sans couleur active n'est pas un produit sans variante : il
  // retombe sur la variante Standard (créée ou réactivée au besoin), qui, elle,
  // ne se désactive jamais.
  async setVariantActive(productId: string, variantId: string, active: boolean) {
    const product = await this.getById(productId);
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(`Variante "${variantId}" introuvable pour ce produit`);
    }
    if (!active && variant.colorId === null) {
      throw new BadRequestException(
        "La variante Standard (sans couleur) ne peut pas être désactivée",
      );
    }

    if (active) {
      const reactivated = await prisma.productVariant.update({
        where: { id: variantId },
        data: { active: true },
        include: { color: true },
      });
      return { removed: false, variant: reactivated };
    }

    return prisma.$transaction(async (tx) => {
      const removable = (await this.variantReferenceCount(tx, variantId)) === 0;
      let result: {
        removed: boolean;
        variant?: Awaited<ReturnType<typeof tx.productVariant.update>>;
      };
      if (removable) {
        await tx.productVariant.delete({ where: { id: variantId } });
        result = { removed: true };
      } else {
        const inactive = await tx.productVariant.update({
          where: { id: variantId },
          data: { active: false },
          include: { color: true },
        });
        result = { removed: false, variant: inactive };
      }

      const remaining = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true, colorId: true, active: true },
      });
      if (!remaining.some((v) => v.active)) {
        const standard = remaining.find((v) => v.colorId === null);
        if (standard) {
          await tx.productVariant.update({ where: { id: standard.id }, data: { active: true } });
        } else {
          await tx.productVariant.create({ data: { productId, sku: product.sku } });
        }
      }
      return result;
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.getById(id);
    return prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        taxRate: dto.taxRate,
        weight: dto.weight,
        active: dto.active,
        documentUrl: dto.documentUrl,
      },
      include: { variants: VARIANTS_INCLUDE, photos: PHOTOS_INCLUDE },
    });
  }

  // Jamais de suppression réelle — un produit peut être référencé par des
  // commandes/mouvements de stock existants (CLAUDE.md §36).
  async archive(id: string) {
    await this.getById(id);
    return prisma.product.update({ where: { id }, data: { active: false } });
  }

  // Ajoute une photo (3 au maximum) et renvoie le produit à jour.
  async addPhoto(id: string, url: string) {
    await this.getById(id);
    const count = await prisma.productPhoto.count({ where: { productId: id } });
    try {
      assertCanAddPhoto(count);
    } catch (error) {
      if (error instanceof ProductPhotoLimitError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await prisma.productPhoto.create({ data: { productId: id, url, position: count } });
    return this.getById(id);
  }

  // Retire une photo, renumérote les suivantes et renvoie le produit à jour
  // avec l'URL retirée (à effacer du disque par l'appelant).
  async removePhoto(id: string, photoId: string) {
    await this.getById(id);
    const photo = await prisma.productPhoto.findFirst({ where: { id: photoId, productId: id } });
    if (!photo) {
      throw new NotFoundException(`Photo "${photoId}" introuvable`);
    }
    await prisma.productPhoto.delete({ where: { id: photo.id } });
    const remaining = await prisma.productPhoto.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });
    await prisma.$transaction(
      remaining.map((item, index) =>
        prisma.productPhoto.update({ where: { id: item.id }, data: { position: index } }),
      ),
    );
    return { product: await this.getById(id), removedUrl: photo.url };
  }
}
