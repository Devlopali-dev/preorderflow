import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { buildRevolutPaymentLink } from "./revolut-link";
import { OrderService } from "../order/order.service";

@Injectable()
export class PaymentService {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async list() {
    return prisma.payment.findMany({ orderBy: { createdAt: "desc" }, include: { order: true } });
  }

  async createForOrder(orderId: string, dto: CreatePaymentDto) {
    const order = await this.orderService.getById(orderId);
    const amount = dto.amount ?? order.total.toNumber();
    const provider = dto.provider ?? "MANUAL";

    const revolutBaseLink = process.env.REVOLUT_PAYMENT_LINK;
    const revolutLink =
      provider === "MANUAL" && revolutBaseLink
        ? buildRevolutPaymentLink(revolutBaseLink, amount)
        : undefined;

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider,
        amount,
        currency: order.currency,
        status: "PENDING",
        metadata: revolutLink ? { revolutLink } : undefined,
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
    await this.orderService.markPaid(payment.orderId);

    return updatedPayment;
  }
}
