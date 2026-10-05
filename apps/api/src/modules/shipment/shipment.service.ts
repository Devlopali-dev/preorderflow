import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, ShipmentStatus } from "@preorderflow/database";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { assertValidShipmentTransition, InvalidShipmentTransitionError } from "./shipment-status";
import { OrderService } from "../order/order.service";
import { CARRIER_LABELS } from "../order/shipping-tariffs";
import { NotificationService } from "../notification/notification.service";

// Statuts d'expédition qui font avancer le fulfillment de la commande.
const ORDER_STATUS_BY_SHIPMENT_STATUS: Partial<Record<ShipmentStatus, "SHIPPED" | "DELIVERED">> = {
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
};

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
      return result;
    });

    const orderStatus = ORDER_STATUS_BY_SHIPMENT_STATUS[status];
    if (orderStatus) {
      const order = await this.orderService.updateStatus(shipment.orderId, orderStatus);
      const customer = await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId } });
      if (orderStatus === "SHIPPED") {
        await this.notificationService.sendEmail(customer.email, "ORDER_SHIPPED", {
          firstName: customer.firstName,
          orderNumber: order.number,
          trackingUrl: shipment.trackingUrl ?? undefined,
        });
      } else {
        await this.notificationService.sendEmail(customer.email, "ORDER_DELIVERED", {
          firstName: customer.firstName,
          orderNumber: order.number,
        });
      }
    }

    return updated;
  }
}
