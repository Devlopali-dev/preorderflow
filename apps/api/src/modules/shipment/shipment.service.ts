import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Prisma, ShipmentStatus } from "@preorderflow/database";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { assertValidShipmentTransition, InvalidShipmentTransitionError } from "./shipment-status";
import { OrderService } from "../order/order.service";
import { CARRIER_LABELS } from "../order/shipping-tariffs";
import { loadOrderItemsHtml } from "../notification/email-layout";
import { NotificationService } from "../notification/notification.service";

// Statuts d'expédition qui font avancer le fulfillment de la commande.
const ORDER_STATUS_BY_SHIPMENT_STATUS: Partial<Record<ShipmentStatus, "SHIPPED" | "DELIVERED">> = {
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
};

export const HAND_DELIVERY_CARRIER = "Remise en main propre";

@Injectable()
export class ShipmentService {
  constructor(
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  async list() {
    return prisma.shipment.findMany({ orderBy: { createdAt: "desc" }, include: { order: true } });
  }

  async getById(id: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { order: true, events: { orderBy: { occurredAt: "asc" } } },
    });
    if (!shipment) {
      throw new NotFoundException(`Expédition "${id}" introuvable`);
    }
    return shipment;
  }

  async create(dto: CreateShipmentDto) {
    const order = await this.orderService.getById(dto.orderId);

    if (order.status !== "READY_TO_SHIP") {
      throw new BadRequestException(
        `La commande doit être "prête à expédier" avant de créer une expédition (statut actuel: ${order.status})`,
      );
    }

    const existing = await prisma.shipment.findUnique({ where: { orderId: order.id } });
    if (existing) {
      throw new BadRequestException("Cette commande a déjà une expédition");
    }

    return prisma.shipment.create({
      data: {
        orderId: order.id,
        // Saisie admin prioritaire ; sinon le transporteur choisi par le client à la commande.
        carrier: dto.carrier ?? (order.carrier ? CARRIER_LABELS[order.carrier] : undefined),
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        weight: dto.weight,
        status: "PENDING",
        events: { create: [{ status: "PENDING", message: "Expédition créée" }] },
      },
      include: { events: true },
    });
  }

  // Remise en main propre : l'expédition est créée déjà livrée et la commande passe directement
  // à « livrée » (en préparation ou prête à expédier), dans une seule transaction. Seul l'e-mail
  // « livrée » part : la commande n'a jamais été expédiée.
  async handDelivery(orderId: string) {
    const order = await this.orderService.getById(orderId);
    this.orderService.assertCanHandDeliver(order);

    if (await prisma.shipment.findUnique({ where: { orderId: order.id } })) {
      throw new BadRequestException("Cette commande a déjà une expédition");
    }

    const now = new Date();
    const shipment = await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { variantId: true, quantity: true },
      });
      const created = await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: HAND_DELIVERY_CARRIER,
          status: "DELIVERED",
          shippedAt: now,
          deliveredAt: now,
          events: {
            create: [
              { status: "PENDING", message: "Expédition créée", occurredAt: now },
              { status: "DELIVERED", message: HAND_DELIVERY_CARRIER, occurredAt: now },
            ],
          },
        },
        include: { events: true },
      });
      await this.orderService.markHandDelivered(tx, order.id);
      // Remise en main propre : le colis n'est jamais « expédié », mais le stock
      // physique est consommé au moment de la remise.
      await this.createSaleMovements(tx, order.id, items);
      return created;
    });

    await this.notificationService.sendEmail(order.customer.email, "ORDER_DELIVERED", {
      firstName: order.customer.firstName,
      orderNumber: order.number,
      items: await loadOrderItemsHtml(order.id),
    });

    return shipment;
  }

  async updateStatus(id: string, status: ShipmentStatus, message?: string) {
    const shipment = await this.getById(id);
    try {
      assertValidShipmentTransition(shipment.status, status);
    } catch (error) {
      if (error instanceof InvalidShipmentTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Une commande non payée ne se livre pas : refus avant toute écriture, sinon
    // l'expédition passerait à « livrée » puis la commande refuserait.
    if (status === "DELIVERED") {
      this.orderService.assertPaidForDelivery(shipment.order.paymentStatus);
    }

    // À l'expédition, on décrémente le stock physique : un mouvement SALE par
    // variante (référence ORDER). La réservation est libérée automatiquement
    // (la commande sort des statuts réservants dès qu'elle passe SHIPPED).
    const items =
      status === "SHIPPED"
        ? await prisma.orderItem.findMany({
            where: { orderId: shipment.orderId },
            select: { variantId: true, quantity: true },
          })
        : [];

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status,
          shippedAt: status === "SHIPPED" ? new Date() : undefined,
          deliveredAt: status === "DELIVERED" ? new Date() : undefined,
        },
      });
      await tx.shipmentEvent.create({
        data: { shipmentId: shipment.id, status, message },
      });
      await this.createSaleMovements(tx, shipment.orderId, items);
      return result;
    });

    const orderStatus = ORDER_STATUS_BY_SHIPMENT_STATUS[status];
    if (orderStatus) {
      const order = await this.orderService.updateStatus(shipment.orderId, orderStatus);
      const customer = await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId } });
      const items = await loadOrderItemsHtml(order.id);
      if (orderStatus === "SHIPPED") {
        await this.notificationService.sendEmail(customer.email, "ORDER_SHIPPED", {
          firstName: customer.firstName,
          orderNumber: order.number,
          trackingUrl: shipment.trackingUrl ?? undefined,
          items,
        });
      } else {
        await this.notificationService.sendEmail(customer.email, "ORDER_DELIVERED", {
          firstName: customer.firstName,
          orderNumber: order.number,
          items,
        });
      }
    }

    return updated;
  }

  /**
   * Crée un mouvement de stock SALE (négatif) par variante au moment où le
   * colis quitte le stock. `items` est le groupement variantId → quantité,
   * agrégé avant d'entrer dans la transaction.
   */
  private async createSaleMovements(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: { variantId: string; quantity: number }[],
  ) {
    const byVariant = new Map<string, number>();
    for (const item of items) {
      byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity);
    }
    for (const [variantId, quantity] of byVariant) {
      await tx.inventoryMovement.create({
        data: {
          variantId,
          quantity: -quantity,
          type: "SALE",
          referenceType: "ORDER",
          referenceId: orderId,
          reason: "Expédition",
        },
      });
    }
  }
}
