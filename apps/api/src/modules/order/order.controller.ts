import { Body, Controller, forwardRef, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { OrderService } from "./order.service";
import { BulkMessageDto, CreateOrderDto, UpdateOrderStatusDto } from "./dto/create-order.dto";
import { PaymentService } from "../payment/payment.service";
import { CreatePaymentDto } from "../payment/dto/create-payment.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(
    @Inject(forwardRef(() => OrderService))
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

  // Déclaré avant ":id" pour ne pas être capté comme un identifiant.
  // Envoie de vrais emails : throttle dédié, comme les routes /settings.
  @Post("bulk-message")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async sendBulkMessage(@Body() dto: BulkMessageDto, @CurrentAdminId() adminId: string) {
    const result = await this.orderService.sendBulkMessage(dto.orderIds, dto.subject, dto.message);
    // Jamais le corps du message dans l'audit : objet + volumétrie seulement.
    await this.auditService.log(adminId, "ORDERS_BULK_MESSAGE_SENT", "Order", "bulk", {
      subject: dto.subject,
      orderIds: dto.orderIds,
      ...result,
    });
    return result;
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

  @Post(":id/payments/confirm")
  async confirmOrderPayment(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const payment = await this.paymentService.confirmForOrder(id);
    if (payment) {
      await this.auditService.log(adminId, "PAYMENT_CONFIRMED", "Payment", payment.id, {
        orderId: id,
      });
    }
    return payment;
  }
}
