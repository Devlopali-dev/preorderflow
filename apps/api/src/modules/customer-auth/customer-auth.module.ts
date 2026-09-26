import { Module } from "@nestjs/common";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerPortalController } from "./customer-portal.controller";
import { CustomerPortalService } from "./customer-portal.service";
import { CustomerAuthGuard } from "./customer-auth.guard";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [CustomerAuthController, CustomerPortalController],
  providers: [CustomerAuthService, CustomerPortalService, CustomerAuthGuard],
})
export class CustomerAuthModule {}
