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

  @Get(":variantId/movements")
  listMovements(@Param("variantId") variantId: string) {
    return this.inventoryService.listMovements(variantId);
  }

  @Post("adjustments")
  async createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentAdminId() adminId: string) {
    const movement = await this.inventoryService.createAdjustment(
      dto.variantId,
      dto.quantity,
      dto.reason,
    );
    await this.auditService.log(adminId, "INVENTORY_ADJUSTED", "InventoryMovement", movement.id, {
      variantId: dto.variantId,
      quantity: dto.quantity,
      reason: dto.reason,
    });
    return movement;
  }
}
