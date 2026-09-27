import { Module } from "@nestjs/common";
import { ShipmentController } from "./shipment.controller";
import { ShipmentService } from "./shipment.service";
import { OrderModule } from "../order/order.module";
import { NotificationModule } from "../notification/notification.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [OrderModule, NotificationModule, AuditModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
