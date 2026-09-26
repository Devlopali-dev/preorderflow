import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";

@ApiTags("payments")
@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  list() {
    return this.paymentService.list();
  }

  // Confirmation manuelle par un opérateur (virement/Revolut reçu).
  @Post(":id/confirm")
  confirm(@Param("id") id: string) {
    return this.paymentService.confirm(id);
  }
}
