import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";

@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list() {
    return this.inventoryService.listAll();
  }

  @Get(":productId/movements")
  listMovements(@Param("productId") productId: string) {
    return this.inventoryService.listMovements(productId);
  }

  @Post("adjustments")
  createAdjustment(@Body() dto: CreateAdjustmentDto) {
    return this.inventoryService.createAdjustment(dto.productId, dto.quantity, dto.reason);
  }
}
