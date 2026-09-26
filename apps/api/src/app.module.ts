import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./health/health.module";
import { CampaignModule } from "./modules/campaign/campaign.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    HealthModule,
    CampaignModule,
  ],
})
export class AppModule {}
