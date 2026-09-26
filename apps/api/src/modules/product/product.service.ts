import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";

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
}
