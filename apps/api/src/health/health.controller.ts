import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiExcludeController } from "@nestjs/swagger";
import { PrismaHealthIndicator } from "./prisma.health";
import { Public } from "../modules/auth/public.decorator";

@Public()
@ApiExcludeController()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaHealth.isHealthy("database")]);
  }
}
