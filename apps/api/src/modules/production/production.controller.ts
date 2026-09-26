import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductionService } from "./production.service";
import { CompleteProductionBatchDto, CreateProductionBatchDto } from "./dto/create-production-batch.dto";

@ApiTags("production")
@Controller("production/batches")
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

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
  start(@Param("id") id: string) {
    return this.productionService.start(id);
  }

  @Post(":id/complete")
  complete(@Param("id") id: string, @Body() dto: CompleteProductionBatchDto) {
    return this.productionService.complete(id, dto);
  }
}
