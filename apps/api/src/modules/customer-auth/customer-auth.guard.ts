import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { CustomerSessionPayload } from "./customer-jwt-payload";

// Distinct de JwtAuthGuard (admin) : vérifie un token de session client
// (type: "customer"), jamais interchangeable avec un token admin même si
// les deux sont signés avec le même secret applicatif — le champ `type`
// empêche un token client de passer pour un token admin et vice-versa.
// Appliqué explicitement sur les routes @Public() de l'espace client
// (le guard global JwtAuthGuard ne le voit jamais).
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentification client requise");
    }

    try {
      const payload = this.jwtService.verify<CustomerSessionPayload>(header.slice("Bearer ".length));
      if (payload.type !== "customer") {
        throw new Error("wrong token type");
      }
      request.customer = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Session invalide ou expirée");
    }
  }
}
