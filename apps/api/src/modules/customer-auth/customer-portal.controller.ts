import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CustomerPortalService } from "./customer-portal.service";
import { UpdateCustomerProfileDto } from "./dto/customer-auth.dto";
import { CustomerAuthGuard } from "./customer-auth.guard";
import { CurrentCustomerId } from "./current-customer.decorator";
import { Public } from "../auth/public.decorator";

// @Public() lève le guard admin global (JwtAuthGuard/RolesGuard) — le
// CustomerAuthGuard, appliqué ici explicitement, est la seule protection
// de ces routes, avec un token de type "customer" strictement distinct
// d'un token admin.
@Public()
@UseGuards(CustomerAuthGuard)
@ApiTags("customer-portal")
@Controller("customer/me")
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Get()
  getProfile(@CurrentCustomerId() customerId: string) {
    return this.customerPortalService.getProfile(customerId);
  }

  @Patch()
  updateProfile(@CurrentCustomerId() customerId: string, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerPortalService.updateProfile(customerId, dto);
  }

  @Get("orders")
  listOrders(@CurrentCustomerId() customerId: string) {
    return this.customerPortalService.listOrders(customerId);
  }

  @Get("orders/:id")
  getOrder(@CurrentCustomerId() customerId: string, @Param("id") orderId: string) {
    return this.customerPortalService.getOrder(customerId, orderId);
  }
}
