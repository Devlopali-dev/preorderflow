import { forwardRef, Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { OrderModule } from "../order/order.module";
import { NotificationModule } from "../notification/notification.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [forwardRef(() => OrderModule), NotificationModule, AuditModule],
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
