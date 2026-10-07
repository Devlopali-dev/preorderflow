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
import {
  type CarrierCode,
  parcelWeightGrams,
  resolveCarrier,
  resolveShippingAmount,
} from "./shipping-fee";
import {
  assertOrderHandDeliverable,
  assertOrderPaidForDelivery,
  OrderNotHandDeliverableError,
  OrderNotPaidError,
} from "./order-rules";
import { assertValidOrderTransition, InvalidOrderTransitionError } from "./order-status";
import { loadOrderItemsHtml } from "../notification/email-layout";
import { NotificationService } from "../notification/notification.service";
import { SettingsService } from "../settings/settings.service";

// Statuts pour lesquels une commande "consomme" du stock réservé
// (cf. docs/architecture.md §5.3 : réservation dès qu'un paiement existe).
const PAYMENT_STATUSES_RESERVING_STOCK: OrderPaymentStatus[] = ["PARTIALLY_PAID", "PAID"];

// Une ligne de commande référence une variante (couleur) ; on charge aussi le
// produit et la couleur pour l'affichage (« Stylo — Rouge »).
const ORDER_ITEM_INCLUDE = { variant: { include: { product: true, color: true } } } as const;

@Injectable()
export class OrderService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
  ) {}

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
        campaign: { select: { id: true, name: true, paymentLink: true } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Commande "${id}" introuvable`);
    }
    return order;
  }

  // `keepExistingCustomer` : pour une commande passée anonymement, un client déjà connu (même
  // email) est réutilisé tel quel, sans réécrire son nom ni son téléphone.
  async create(dto: CreateOrderDto, options: { keepExistingCustomer?: boolean } = {}) {
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
        // Poids produit en kg en base ; le barème La Poste raisonne en grammes.
        weightGrams: (variant.product.weight?.toNumber() ?? 0) * 1000,
      };
    });

    if (dto.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: dto.campaignId } });
      if (!campaign) {
        throw new BadRequestException("Campagne introuvable");
      }
    }

    // Montant explicite (saisie admin) prioritaire ; sinon frais paramétrés dans /settings.
    const itemsSubtotal = computeOrderTotals(lines).subtotal;
    const deliveryMethod = dto.deliveryMethod ?? "SHIPPING";
    const shippingConfig = await this.settingsService.getShippingConfig();
    const weightGrams = parcelWeightGrams(
      lines.reduce((sum, line) => sum + line.quantity * line.weightGrams, 0),
      shippingConfig,
    );
    let carrier: CarrierCode | null;
    try {
      carrier = resolveCarrier(deliveryMethod, weightGrams, shippingConfig, dto.carrier);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const shippingAmount = resolveShippingAmount(
      deliveryMethod,
      itemsSubtotal,
      shippingConfig,
      dto.shippingAmount,
      carrier,
      weightGrams,
    );
    const totals = computeOrderTotals(lines, shippingAmount);
    // Remise en main propre : pas d'adresse, le snapshot ne garde que l'identité du client.
    const shippingAddress = dto.shippingAddress ?? {
      firstName: dto.customerFirstName,
      lastName: dto.customerLastName,
    };
    const billingAddress = dto.billingAddress ?? shippingAddress;

    const order = await prisma.$transaction(async (tx) => {
      // Le numéro est calculé dans la même transaction que l'insertion, sous
      // verrou : deux créations simultanées ne peuvent plus lire le même MAX.
      const orderNumber = await this.generateOrderNumber(tx);

      const customer = await tx.customer.upsert({
        where: { email: dto.customerEmail },
        update: options.keepExistingCustomer
          ? {}
          : {
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
          campaignId: dto.campaignId,
          status: "DRAFT",
          paymentStatus: "UNPAID",
          fulfillmentStatus: "UNFULFILLED",
          deliveryMethod,
          carrier,
          subtotal: totals.subtotal,
          shippingAmount,
          taxAmount: totals.taxAmount,
          total: totals.total,
          billingAddress: billingAddress as object,
          shippingAddress: shippingAddress as object,
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
      items: await loadOrderItemsHtml(order.id),
    });
    await this.notificationService.notifyAdmin(
      "Nouvelle commande",
      `${order.number} — ${dto.customerFirstName} ${dto.customerLastName} — ${order.total.toFixed(2)} €`,
      ["package"],
    );

    return order;
  }

  // Refus métier converti en 400 ; utilisé aussi par les expéditions, qui doivent
  // refuser AVANT d'écrire quoi que ce soit.
  assertPaidForDelivery(paymentStatus: string) {
    try {
      assertOrderPaidForDelivery(paymentStatus);
    } catch (error) {
      if (error instanceof OrderNotPaidError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // Refus métier (400) d'une remise en main propre : statut incompatible ou commande non payée.
  assertCanHandDeliver(order: { status: string; paymentStatus: string }) {
    try {
      assertOrderHandDeliverable(order.status);
    } catch (error) {
      if (error instanceof OrderNotHandDeliverableError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    this.assertPaidForDelivery(order.paymentStatus);
  }

  // Passe la commande à « livrée » dans la transaction de l'appelant (remise en main propre :
  // pas d'étape expédiée, donc pas de transition par `updateStatus`).
  markHandDelivered(tx: Prisma.TransactionClient, id: string) {
    return tx.order.update({
      where: { id },
      data: { status: "DELIVERED", fulfillmentStatus: "DELIVERED" },
    });
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

    if (status === "DELIVERED") {
      this.assertPaidForDelivery(order.paymentStatus);
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
        items: await loadOrderItemsHtml(order.id),
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
