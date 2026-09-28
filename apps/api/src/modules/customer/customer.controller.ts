import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CustomerService } from "./customer.service";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";
import { Roles } from "../auth/roles.decorator";

@ApiTags("customers")
@Controller("customers")
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.customerService.list();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.customerService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentAdminId() adminId: string,
  ) {
    const customer = await this.customerService.update(id, dto);
    await this.auditService.log(adminId, "CUSTOMER_UPDATED", "Customer", customer.id, dto);
    return customer;
  }

  // RGPD (§24) — restreint à ADMIN : premier usage réel du RBAC au-delà de
  // "authentifié", export/anonymisation sont des actions sensibles.
  @Roles("ADMIN")
  @Post(":id/gdpr-export")
  async exportData(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const data = await this.customerService.exportData(id);
    await this.auditService.log(adminId, "CUSTOMER_DATA_EXPORTED", "Customer", id, {});
    return data;
  }

  @Roles("ADMIN")
  @Post(":id/gdpr-anonymize")
  async anonymize(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const customer = await this.customerService.anonymize(id);
    await this.auditService.log(adminId, "CUSTOMER_ANONYMIZED", "Customer", id, {});
    return customer;
  }
}
