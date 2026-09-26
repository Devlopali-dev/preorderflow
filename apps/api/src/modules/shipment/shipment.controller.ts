import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ShipmentService } from "./shipment.service";
import { CreateShipmentDto, UpdateShipmentStatusDto } from "./dto/create-shipment.dto";

@ApiTags("shipments")
@Controller("shipments")
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get()
  list() {
    return this.shipmentService.list();
  }

  @Post()
  create(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(dto);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.shipmentService.getById(id);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateShipmentStatusDto) {
    return this.shipmentService.updateStatus(id, dto.status as never, dto.message);
  }
}
