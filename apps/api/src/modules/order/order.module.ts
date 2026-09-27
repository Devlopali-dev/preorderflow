import { forwardRef, Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { PaymentModule } from "../payment/payment.module";
import { NotificationModule } from "../notification/notification.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [forwardRef(() => PaymentModule), NotificationModule, AuditModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
