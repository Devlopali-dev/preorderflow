import { Module } from "@nestjs/common";
import { ProductionController } from "./production.controller";
import { ProductionService } from "./production.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
