import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";

// Variantes (couleurs) d'un produit, avec leur couleur pour l'affichage.
const VARIANTS_INCLUDE = { include: { color: true }, orderBy: { sku: "asc" } } as const;

// « Rouge vif » -> « ROUGE-VIF » : suffixe de SKU sans accents ni espaces.
function skuSuffix(colorName: string): string {
  return colorName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class ProductService {
  async list() {
    return prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { variants: VARIANTS_INCLUDE },
    });
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: VARIANTS_INCLUDE },
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
        slug: dto.slug,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        taxRate: dto.taxRate,
        weight: dto.weight,
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
        // Invariant : tout produit a au moins une variante. Sans couleur,
        // la variante par défaut reprend le SKU du produit.
        variants: { create: [{ sku: dto.sku }] },
      },
      include: { variants: VARIANTS_INCLUDE },
    });
  }

  // Ajoute une couleur de la palette au produit. La variante par défaut
  // (sans couleur) est retirée si rien ne la référence encore : un produit
  // « Stylo » devient « Stylo Rouge / Bleu », pas « Stylo + Rouge ».
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

      const defaultVariant = product.variants.find((v) => v.colorId === null);
      if (defaultVariant) {
        const references = await Promise.all([
          tx.orderItem.count({ where: { variantId: defaultVariant.id } }),
          tx.productionItem.count({ where: { variantId: defaultVariant.id } }),
          tx.inventoryMovement.count({ where: { variantId: defaultVariant.id } }),
          tx.campaignInterestItem.count({ where: { variantId: defaultVariant.id } }),
        ]);
        if (references.every((count) => count === 0)) {
          await tx.productVariant.delete({ where: { id: defaultVariant.id } });
        }
      }
      return variant;
    });
  }

  // Une variante n'est jamais supprimée (stock, commandes, intérêts) : on
  // l'active ou la désactive, en gardant toujours une variante active.
  async setVariantActive(productId: string, variantId: string, active: boolean) {
    const product = await this.getById(productId);
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(`Variante "${variantId}" introuvable pour ce produit`);
    }
    if (!active && product.variants.filter((v) => v.active && v.id !== variantId).length === 0) {
      throw new BadRequestException("Un produit doit garder au moins une variante active");
    }
    return prisma.productVariant.update({
      where: { id: variantId },
      data: { active },
      include: { color: true },
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
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
      },
    });
  }

  // Jamais de suppression réelle — un produit peut être référencé par des
  // commandes/mouvements de stock existants (CLAUDE.md §36).
  async archive(id: string) {
    await this.getById(id);
    return prisma.product.update({ where: { id }, data: { active: false } });
  }
}
