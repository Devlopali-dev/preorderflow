import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const CurrentCustomerId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // CustomerAuthGuard garantit request.customer avant que ce décorateur ne
    // soit évalué — jamais undefined sur une route protégée par ce guard.
    return request.customer!.sub;
  },
);
