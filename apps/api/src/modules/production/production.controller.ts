import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductionService } from "./production.service";
import { CompleteProductionBatchDto, CreateProductionBatchDto } from "./dto/create-production-batch.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("production")
@Controller("production/batches")
export class ProductionController {
  constructor(
    private readonly productionService: ProductionService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.productionService.list();
  }

  @Post()
  create(@Body() dto: CreateProductionBatchDto) {
    return this.productionService.create(dto);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productionService.getById(id);
  }

  @Post(":id/start")
  async start(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const batch = await this.productionService.start(id);
    await this.auditService.log(adminId, "PRODUCTION_STARTED", "ProductionBatch", batch.id, {
      reference: batch.reference,
    });
    return batch;
  }

  @Post(":id/complete")
  async complete(
    @Param("id") id: string,
    @Body() dto: CompleteProductionBatchDto,
    @CurrentAdminId() adminId: string,
  ) {
    const batch = await this.productionService.complete(id, dto);
    if (batch.status === "COMPLETED") {
      await this.auditService.log(adminId, "PRODUCTION_COMPLETED", "ProductionBatch", batch.id, {
        reference: batch.reference,
      });
    }
    return batch;
  }
}
