import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { throttlerModuleOptions } from "./common/rate-limit";
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
import { NotificationModule } from "./modules/notification/notification.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CustomerAuthModule } from "./modules/customer-auth/customer-auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ColorModule } from "./modules/color/color.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Le .env vit à la racine du monorepo, pas dans apps/api — cwd du
      // process NestJS = apps/api, donc le défaut de ConfigModule le rate.
      envFilePath: join(__dirname, "../../../.env"),
    }),
    ThrottlerModule.forRoot(throttlerModuleOptions()),
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
    NotificationModule,
    AuthModule,
    CustomerAuthModule,
    AuditModule,
    SettingsModule,
    ColorModule,
  ],
  providers: [
    // Sans ce garde global, les `@Throttle` des routes sensibles (login, magic link, recensement,
    // commande publique…) n'ont aucun effet : le module seul ne limite rien.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
