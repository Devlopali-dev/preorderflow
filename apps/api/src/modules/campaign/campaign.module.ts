import { Module } from "@nestjs/common";
import { CampaignController } from "./campaign.controller";
import { CampaignOrderService } from "./campaign-order.service";
import { CampaignScheduler } from "./campaign-scheduler";
import { CampaignService } from "./campaign.service";
import { PdfThumbnailService } from "./pdf-thumbnail.service";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";
import { OrderModule } from "../order/order.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [NotificationModule, AuditModule, OrderModule, PaymentModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignOrderService, CampaignScheduler, PdfThumbnailService],
})
export class CampaignModule {}
