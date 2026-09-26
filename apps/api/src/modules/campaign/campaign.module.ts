import { Module } from "@nestjs/common";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [NotificationModule],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}
