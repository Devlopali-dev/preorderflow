import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("payments")
@Controller("payments")
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.paymentService.list();
  }

  // Confirmation manuelle par un opérateur (virement/Revolut reçu).
  @Post(":id/confirm")
  async confirm(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const payment = await this.paymentService.confirm(id);
    await this.auditService.log(adminId, "PAYMENT_CONFIRMED", "Payment", payment.id, {
      orderId: payment.orderId,
    });
    return payment;
  }
}
