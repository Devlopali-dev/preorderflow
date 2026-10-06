import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { buildRevolutPaymentLink } from "./revolut-link";
import { assertOrderAcceptsPayment, OrderNotPayableError } from "./payment-rules";
import { getStripeClient, isStripeConfigured } from "./stripe-client";
import { OrderService } from "../order/order.service";
import { loadOrderItemsHtml } from "../notification/email-layout";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class PaymentService {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  async list() {
    return prisma.payment.findMany({ orderBy: { createdAt: "desc" }, include: { order: true } });
  }

  // Convertit le refus métier en 400 (une commande annulée n'a plus de paiement à gérer).
  private assertPayable(orderStatus: string) {
    try {
      assertOrderAcceptsPayment(orderStatus);
    } catch (error) {
      if (error instanceof OrderNotPayableError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async createForOrder(orderId: string, dto: CreatePaymentDto) {
    const order = await this.orderService.getById(orderId);
    this.assertPayable(order.status);
    const amount = dto.amount ?? order.total.toNumber();
    const provider = dto.provider ?? "MANUAL";

    let providerReference: string | undefined;
    let metadata: Record<string, unknown> | undefined;

    if (provider === "STRIPE") {
      if (!isStripeConfigured()) {
        throw new BadRequestException(
          "Stripe n'est pas configuré (STRIPE_SECRET_KEY manquante) — choisissez un autre mode de paiement.",
        );
      }
      const session = await createStripeCheckoutSession(
        order.id,
        order.number,
        amount,
        order.currency,
      );
      providerReference = session.id;
      metadata = { stripeCheckoutUrl: session.url };
    } else if (provider === "MANUAL") {
      // Lien de la campagne d'origine, à défaut celui du .env.
      const baseLink = order.campaign?.paymentLink ?? process.env.REVOLUT_PAYMENT_LINK;
      if (baseLink) {
        metadata = { paymentLink: buildRevolutPaymentLink(baseLink, amount, order.currency) };
      }
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider,
        providerReference,
        amount,
        currency: order.currency,
        status: "PENDING",
        metadata: metadata as object,
      },
    });

    if (order.status === "DRAFT") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT" } });
    }

    return payment;
  }

  async confirm(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException(`Paiement "${paymentId}" introuvable`);
    }
    // Confirmation manuelle par un admin : refusée sur une commande annulée ou
    // remboursée, AVANT toute écriture (sinon le paiement passerait à « payé »
    // puis le passage de la commande à « payée » échouerait). Le webhook d'un
    // provider (confirmByProviderReference) garde son comportement : un
    // encaissement réel ne doit pas être ignoré en silence.
    if (payment.status === "PENDING" || payment.status === "AUTHORIZED") {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: { status: true },
      });
      this.assertPayable(order.status);
    }
    return this.confirmPayment(payment);
  }

  /**
   * Confirme le paiement en attente d'une commande (raccourci admin depuis la
   * liste des commandes, sans avoir l'id du paiement sous la main). Retrouve le
   * paiement en attente/autorisé de la commande et réutilise la confirmation
   * classique (garde « payable » incluse). Ne fait rien s'il n'y a pas de
   * paiement à confirmer.
   */
  async confirmForOrder(orderId: string) {
    const payment = await prisma.payment.findFirst({
      where: { orderId, status: { in: ["PENDING", "AUTHORIZED"] } },
      orderBy: { createdAt: "asc" },
    });
    if (!payment) {
      return null;
    }
    return this.confirm(payment.id);
  }

  /**
   * Confirmation par un provider externe (webhook Stripe) : identifie le
   * paiement par la référence stockée à la création (id de session Stripe),
   * jamais par un id de commande fourni par la requête entrante.
   */
  async confirmByProviderReference(providerReference: string) {
    const payment = await prisma.payment.findFirst({ where: { providerReference } });
    if (!payment) {
      throw new NotFoundException(`Paiement pour la référence "${providerReference}" introuvable`);
    }
    return this.confirmPayment(payment);
  }

  private async confirmPayment(payment: {
    id: string;
    status: string;
    orderId: string;
    amount: unknown;
  }) {
    if (payment.status === "PAID") {
      return payment;
    }
    if (payment.status !== "PENDING" && payment.status !== "AUTHORIZED") {
      throw new BadRequestException(`Impossible de confirmer un paiement "${payment.status}"`);
    }

    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date() },
      }),
    ]);
    const order = await this.orderService.markPaid(payment.orderId);
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId } });

    await this.notificationService.sendEmail(customer.email, "PAYMENT_RECEIVED", {
      firstName: customer.firstName,
      orderNumber: order.number,
      amount: updatedPayment.amount.toFixed(2),
      items: await loadOrderItemsHtml(order.id),
    });
    await this.notificationService.notifyAdmin(
      "Paiement reçu",
      `${order.number} — ${updatedPayment.amount.toFixed(2)} €`,
      ["moneybag"],
    );

    return updatedPayment;
  }
}

async function createStripeCheckoutSession(
  orderId: string,
  orderNumber: string,
  amount: number,
  currency: string,
) {
  const stripe = getStripeClient();
  const webUrl = process.env.WEB_URL ?? "http://localhost:3000";

  try {
    return await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: { name: `Commande ${orderNumber}` },
          },
          quantity: 1,
        },
      ],
      metadata: { orderId, orderNumber },
      success_url: `${webUrl}/orders/${orderId}?stripe=success`,
      cancel_url: `${webUrl}/orders/${orderId}?stripe=cancelled`,
    });
  } catch (error) {
    throw new BadRequestException(`Erreur Stripe: ${(error as Error).message}`);
  }
}
