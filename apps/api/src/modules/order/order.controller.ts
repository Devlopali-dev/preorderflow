import { Body, Controller, forwardRef, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrderService } from "./order.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/create-order.dto";
import { PaymentService } from "../payment/payment.service";
import { CreatePaymentDto } from "../payment/dto/create-payment.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.orderService.list();
  }

  @Post()
  async create(@Body() dto: CreateOrderDto, @CurrentAdminId() adminId: string) {
    const order = await this.orderService.create(dto);
    await this.auditService.log(adminId, "ORDER_CREATED", "Order", order.id, {
      number: order.number,
    });
    return order;
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.orderService.getById(id);
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdminId() adminId: string,
  ) {
    const order = await this.orderService.updateStatus(id, dto.status as never);
    if (dto.status === "CANCELLED") {
      await this.auditService.log(adminId, "ORDER_CANCELLED", "Order", order.id, {
        number: order.number,
      });
    }
    return order;
  }

  @Post(":id/payments")
  createPayment(@Param("id") id: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createForOrder(id, dto);
  }
}
