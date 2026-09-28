import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductService {
  async list() {
    return prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
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
      },
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
