import { Body, Controller, forwardRef, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrderService } from "./order.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/create-order.dto";
import { PaymentService } from "../payment/payment.service";
import { CreatePaymentDto } from "../payment/dto/create-payment.dto";

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  list() {
    return this.orderService.list();
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.orderService.getById(id);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(id, dto.status as never);
  }

  @Post(":id/payments")
  createPayment(@Param("id") id: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createForOrder(id, dto);
  }
}
