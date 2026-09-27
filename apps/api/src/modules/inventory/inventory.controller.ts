import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.inventoryService.listAll();
  }

  @Get(":productId/movements")
  listMovements(@Param("productId") productId: string) {
    return this.inventoryService.listMovements(productId);
  }

  @Post("adjustments")
  async createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentAdminId() adminId: string) {
    const movement = await this.inventoryService.createAdjustment(dto.productId, dto.quantity, dto.reason);
    await this.auditService.log(adminId, "INVENTORY_ADJUSTED", "InventoryMovement", movement.id, {
      productId: dto.productId,
      quantity: dto.quantity,
      reason: dto.reason,
    });
    return movement;
  }
}
