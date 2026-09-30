import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  prisma,
  Prisma,
  OrderStatus,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
} from "@preorderflow/database";
import { CreateOrderDto } from "./dto/create-order.dto";
import { computeOrderTotals } from "./order-totals";
import { assertValidOrderTransition, InvalidOrderTransitionError } from "./order-status";
import { NotificationService } from "../notification/notification.service";

// Statuts pour lesquels une commande "consomme" du stock réservé
// (cf. docs/architecture.md §5.3 : réservation dès qu'un paiement existe).
const PAYMENT_STATUSES_RESERVING_STOCK: OrderPaymentStatus[] = ["PARTIALLY_PAID", "PAID"];

// Une ligne de commande référence une variante (couleur) ; on charge aussi le
// produit et la couleur pour l'affichage (« Sifflet — Rouge »).
const ORDER_ITEM_INCLUDE = { variant: { include: { product: true, color: true } } } as const;

@Injectable()
export class OrderService {
  constructor(private readonly notificationService: NotificationService) {}

  async list() {
    return prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { include: ORDER_ITEM_INCLUDE }, customer: true },
    });
  }

  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: ORDER_ITEM_INCLUDE },
        customer: true,
        payments: true,
        shipment: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Commande "${id}" introuvable`);
    }
    return order;
  }

  async create(dto: CreateOrderDto) {
    const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, active: true },
      include: { product: true },
    });
    if (variants.length !== variantIds.length) {
      throw new BadRequestException("Une ou plusieurs variantes sont introuvables ou inactives");
    }

    const lines = dto.items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      return {
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice: variant.product.price.toNumber(),
        taxRate: variant.product.taxRate.toNumber(),
      };
    });

    const totals = computeOrderTotals(lines, dto.shippingAmount ?? 0);
    const billingAddress = dto.billingAddress ?? dto.shippingAddress;

    const order = await prisma.$transaction(async (tx) => {
      // Le numéro est calculé dans la même transaction que l'insertion, sous
      // verrou : deux créations simultanées ne peuvent plus lire le même MAX.
      const orderNumber = await this.generateOrderNumber(tx);

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
              variantId: lines[index]!.variantId,
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
    if (
      order.status === "PAID" ||
      ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(order.status)
    ) {
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
  //
  // Doit être appelé dans la transaction qui insère la commande : le verrou
  // consultatif est pris jusqu'au commit, donc la commande suivante voit le
  // numéro déjà inséré. Sans lui, le MAX lu par deux requêtes concurrentes
  // est identique et la seconde échoue sur l'unicité de `number` (500).
  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('order_number'))`;
    const year = new Date().getUTCFullYear();
    const prefix = `${year}-`;
    const last = await tx.order.findFirst({
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
