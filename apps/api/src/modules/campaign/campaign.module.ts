import { Module } from "@nestjs/common";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";
import { PdfThumbnailService } from "./pdf-thumbnail.service";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [NotificationModule, AuditModule],
  controllers: [CampaignController],
  providers: [CampaignService, PdfThumbnailService],
})
export class CampaignModule {}
