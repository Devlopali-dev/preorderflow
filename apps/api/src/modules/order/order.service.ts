import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, OrderStatus, OrderPaymentStatus, OrderFulfillmentStatus } from "@preorderflow/database";
import { CreateOrderDto } from "./dto/create-order.dto";
import { computeOrderTotals } from "./order-totals";
import { assertValidOrderTransition, InvalidOrderTransitionError } from "./order-status";
import { NotificationService } from "../notification/notification.service";

// Statuts pour lesquels une commande "consomme" du stock réservé
// (cf. docs/architecture.md §5.3 : réservation dès qu'un paiement existe).
const PAYMENT_STATUSES_RESERVING_STOCK: OrderPaymentStatus[] = ["PARTIALLY_PAID", "PAID"];

@Injectable()
export class OrderService {
  constructor(private readonly notificationService: NotificationService) {}

  async list() {
    return prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true, customer: true },
    });
  }

  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, customer: true, payments: true, shipment: true },
    });
    if (!order) {
      throw new NotFoundException(`Commande "${id}" introuvable`);
    }
    return order;
  }

  async create(dto: CreateOrderDto) {
    const products = await prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });
    if (products.length !== dto.items.length) {
      throw new BadRequestException("Un ou plusieurs produits sont introuvables");
    }

    const lines = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price.toNumber(),
        taxRate: product.taxRate.toNumber(),
      };
    });

    const totals = computeOrderTotals(lines, dto.shippingAmount ?? 0);
    const billingAddress = dto.billingAddress ?? dto.shippingAddress;
    const orderNumber = await this.generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: dto.customerEmail },
        update: {
          firstName: dto.customerFirstName,
          lastName: dto.customerLastName,
          phone: dto.customerPhone ?? undefined,
        },
        create: {
          email: dto.customerEmail,
          firstName: dto.customerFirstName,
          lastName: dto.customerLastName,
          phone: dto.customerPhone,
        },
      });

      return tx.order.create({
        data: {
          number: orderNumber,
          customerId: customer.id,
          status: "DRAFT",
          paymentStatus: "UNPAID",
          fulfillmentStatus: "UNFULFILLED",
          subtotal: totals.subtotal,
          shippingAmount: dto.shippingAmount ?? 0,
          taxAmount: totals.taxAmount,
          total: totals.total,
          billingAddress: billingAddress as object,
          shippingAddress: dto.shippingAddress as object,
          notes: dto.notes,
          items: {
            create: totals.items.map((item, index) => ({
              productId: lines[index]!.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              total: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });
    });

    await this.notificationService.sendEmail(dto.customerEmail, "ORDER_CREATED", {
      firstName: dto.customerFirstName,
      orderNumber: order.number,
      total: order.total.toFixed(2),
    });
    await this.notificationService.notifyAdmin(
      "Nouvelle commande",
      `${order.number} — ${dto.customerFirstName} ${dto.customerLastName} — ${order.total.toFixed(2)} €`,
      ["package"],
    );

    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.getById(id);
    try {
      assertValidOrderTransition(order.status, status);
    } catch (error) {
      if (error instanceof InvalidOrderTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const fulfillmentStatus = mapOrderStatusToFulfillment(status) ?? order.fulfillmentStatus;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status, fulfillmentStatus },
    });

    if (status === "READY_TO_SHIP") {
      await this.notificationService.sendEmail(order.customer.email, "ORDER_READY", {
        firstName: order.customer.firstName,
        orderNumber: order.number,
      });
    }

    return updated;
  }

  /**
   * Marque une commande comme payée après confirmation d'un paiement.
   * Ne fait rien si la commande est déjà payée ou plus loin dans le
   * cycle (idempotent), refuse si la commande est annulée/remboursée.
   */
  async markPaid(orderId: string) {
    const order = await this.getById(orderId);
    if (order.status === "PAID" || ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(order.status)) {
      return order;
    }
    try {
      assertValidOrderTransition(order.status, "PAID");
    } catch (error) {
      if (error instanceof InvalidOrderTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentStatus: "PAID" },
    });
  }

  // Basé sur le MAX de la séquence existante, pas un COUNT() : après une
  // suppression (tests, annulation nettoyée manuellement), un COUNT()
  // aurait régénéré un numéro déjà pris par une commande restante.
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `${year}-`;
    const last = await prisma.order.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const lastSeq = last ? Number(last.number.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
  }
}

function mapOrderStatusToFulfillment(status: OrderStatus): OrderFulfillmentStatus | null {
  switch (status) {
    case "PROCESSING":
      return "PROCESSING";
    case "READY_TO_SHIP":
      return "READY_TO_SHIP";
    case "SHIPPED":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    default:
      return null;
  }
}

// Réexporté pour un usage futur par le module Inventory (calcul du stock
// réservé) sans dupliquer la liste des statuts concernés.
export { PAYMENT_STATUSES_RESERVING_STOCK };
