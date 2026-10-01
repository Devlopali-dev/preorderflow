import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { UpdateCustomerProfileDto } from "./dto/customer-auth.dto";
import { assertPaymentChoiceOpen, PaymentChoiceClosedError } from "./payment-choice-rules";
import { NotificationService } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";

@Injectable()
export class CustomerPortalService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
  ) {}

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

  private assertChoiceOpen(orderStatus: string) {
    try {
      assertPaymentChoiceOpen(orderStatus);
    } catch (error) {
      if (error instanceof PaymentChoiceClosedError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // « Payer maintenant » : génère le règlement manuel (lien Revolut avec le montant
  // attendu) et met la commande en attente de paiement. L'admin vérifie ensuite le
  // virement à la main. Rejouable : un règlement en attente déjà généré est renvoyé tel quel.
  async payNow(customerId: string, orderId: string) {
    const order = await this.getOrder(customerId, orderId);
    this.assertChoiceOpen(order.status);

    const existing = order.payments.find((p) => p.provider === "MANUAL" && p.status === "PENDING");
    const payment =
      existing ?? (await this.paymentService.createForOrder(order.id, { provider: "MANUAL" }));
    if (!existing) {
      await this.notificationService.notifyAdmin(
        "Paiement annoncé",
        `${order.number} — ${order.total.toFixed(2)} € — à vérifier`,
        ["hourglass"],
      );
    }

    const metadata = payment.metadata as { paymentLink?: string } | null;
    return { amount: payment.amount, paymentLink: metadata?.paymentLink ?? null };
  }

  // « Plus tard » : rien n'est généré, l'admin est prévenu pour envoyer le mail de validation.
  async payLater(customerId: string, orderId: string) {
    const order = await this.getOrder(customerId, orderId);
    this.assertChoiceOpen(order.status);
    await this.notificationService.notifyAdmin(
      "Paiement différé",
      `${order.number} — le client paiera plus tard : un mail de validation est à envoyer`,
      ["alarm_clock"],
    );
    return { ok: true };
  }
}
