import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./health/health.module";
import { CampaignModule } from "./modules/campaign/campaign.module";
import { CustomerModule } from "./modules/customer/customer.module";
import { OrderModule } from "./modules/order/order.module";
import { ProductModule } from "./modules/product/product.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { ProductionModule } from "./modules/production/production.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ShipmentModule } from "./modules/shipment/shipment.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Le .env vit à la racine du monorepo, pas dans apps/api — cwd du
      // process NestJS = apps/api, donc le défaut de ConfigModule le rate.
      envFilePath: join(__dirname, "../../../.env"),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    HealthModule,
    CampaignModule,
    CustomerModule,
    OrderModule,
    ProductModule,
    DashboardModule,
    PaymentModule,
    ProductionModule,
    InventoryModule,
    ShipmentModule,
  ],
})
export class AppModule {}
