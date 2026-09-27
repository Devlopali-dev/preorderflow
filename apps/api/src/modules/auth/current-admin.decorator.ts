import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

// Extrait l'id de l'admin authentifié (JwtAuthGuard garantit request.user
// sur toute route non @Public()) — utilisé pour tracer qui a fait quoi
// dans AuditLog, jamais un id fourni par le corps de la requête.
export const CurrentAdminId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user!.sub;
});
