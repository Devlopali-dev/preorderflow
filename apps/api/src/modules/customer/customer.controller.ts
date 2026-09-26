import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CustomerService } from "./customer.service";

@ApiTags("customers")
@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  list() {
    return this.customerService.list();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.customerService.getById(id);
  }
}
