import { Module } from "@nestjs/common";
import { ShipmentController } from "./shipment.controller";
import { ShipmentService } from "./shipment.service";
import { OrderModule } from "../order/order.module";

@Module({
  imports: [OrderModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
