import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { UpdateCustomerProfileDto } from "./dto/customer-auth.dto";

@Injectable()
export class CustomerPortalService {
  async getProfile(customerId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Client introuvable");
    }
    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    return prisma.customer.update({ where: { id: customerId }, data: dto });
  }

  // Toujours scopé par customerId depuis le token, jamais un paramètre
  // d'URL — un client ne doit jamais pouvoir lire les données d'un autre
  // (CLAUDE.md §23).
  async listOrders(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { variant: { include: { product: true, color: true } } } },
        shipment: true,
      },
    });
  }

  async getOrder(customerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        items: { include: { variant: { include: { product: true, color: true } } } },
        payments: true,
        shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } },
      },
    });
    if (!order) {
      // 404, jamais 403 : ne pas confirmer qu'une commande existe pour
      // quelqu'un d'autre.
      throw new NotFoundException("Commande introuvable");
    }
    return order;
  }
}
