import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ShipmentService } from "./shipment.service";
import {
  CreateShipmentDto,
  HandDeliveryDto,
  UpdateShipmentStatusDto,
} from "./dto/create-shipment.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("shipments")
@Controller("shipments")
export class ShipmentController {
  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.shipmentService.list();
  }

  @Post()
  async create(@Body() dto: CreateShipmentDto, @CurrentAdminId() adminId: string) {
    const shipment = await this.shipmentService.create(dto);
    await this.auditService.log(adminId, "SHIPMENT_CREATED", "Shipment", shipment.id, {
      orderId: dto.orderId,
    });
    return shipment;
  }

  @Post("hand-delivery")
  async handDelivery(@Body() dto: HandDeliveryDto, @CurrentAdminId() adminId: string) {
    const shipment = await this.shipmentService.handDelivery(dto.orderId);
    await this.auditService.log(adminId, "SHIPMENT_CREATED", "Shipment", shipment.id, {
      orderId: dto.orderId,
      handDelivery: true,
    });
    return shipment;
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.shipmentService.getById(id);
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentAdminId() adminId: string,
  ) {
    const shipment = await this.shipmentService.updateStatus(id, dto.status as never, dto.message);
    await this.auditService.log(adminId, "SHIPMENT_UPDATED", "Shipment", shipment.id, {
      status: dto.status,
    });
    return shipment;
  }
}
