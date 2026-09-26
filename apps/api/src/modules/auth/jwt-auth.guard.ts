import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { JwtPayload } from "./jwt-payload";

const VALID_ADMIN_ROLES = new Set(["ADMIN", "OPERATOR"]);

// Protège TOUTES les routes par défaut (enregistré comme APP_GUARD global) ;
// @Public() est la seule façon d'exempter une route. Ne jamais faire
// confiance aux permissions du frontend (CLAUDE.md §26) — cette vérification
// est la seule qui compte.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Authentification requise");
    }

    try {
      // Pas de `secret` explicite ici : JwtService utilise celui configuré
      // par JwtModule.registerAsync (via ConfigService, cf. auth.module.ts).
      const payload = this.jwtService.verify<JwtPayload>(token);
      // Un token client (payload.type === "customer", cf. customer-auth)
      // est signé avec le même secret applicatif et passerait la
      // vérification de signature ci-dessus — le champ `role` est le seul
      // discriminant. Sans cette vérification, une session client valide
      // donnerait accès à toute route admin dépourvue de @Roles() (bug
      // réel trouvé en testant l'espace client de bout en bout).
      if (!VALID_ADMIN_ROLES.has(payload.role)) {
        throw new Error("not an admin token");
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token invalide ou expiré");
    }
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}
