import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";

@Injectable()
export class CustomerService {
  async list() {
    return prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true, orders: true },
    });
    if (!customer) {
      throw new NotFoundException(`Client "${id}" introuvable`);
    }
    return customer;
  }
}
