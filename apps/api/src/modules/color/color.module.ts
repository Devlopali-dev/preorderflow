import { Module } from "@nestjs/common";
import { ColorController } from "./color.controller";
import { ColorService } from "./color.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ColorController],
  providers: [ColorService],
})
export class ColorModule {}
