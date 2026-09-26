import { describe, expect, it, vi } from "vitest";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard";

function makeContext(authorization?: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  it("laisse passer une route @Public() sans vérifier de token", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;
    const jwtService = { verify: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it("refuse sans en-tête Authorization", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verify: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });

  it("refuse un en-tête mal formé (pas de préfixe Bearer)", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verify: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    expect(() => guard.canActivate(makeContext("token-sans-bearer"))).toThrow(UnauthorizedException);
  });

  it("refuse un token que jwtService rejette (expiré/invalide)", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = {
      verify: vi.fn().mockImplementation(() => {
        throw new Error("invalid");
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    expect(() => guard.canActivate(makeContext("Bearer bad.token.here"))).toThrow(UnauthorizedException);
  });

  it("refuse un token valide mais sans rôle admin (ex: session client) — régression réelle", () => {
    // Un token client (customer-auth) est signé avec le même secret
    // applicatif que les tokens admin ; sans cette vérification du rôle,
    // il passait ce guard et donnait accès à toute route admin dépourvue
    // de @Roles() explicite. Trouvé en testant l'espace client en réel.
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = {
      verify: vi.fn().mockReturnValue({ sub: "customer-1", type: "customer" }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    expect(() => guard.canActivate(makeContext("Bearer customer.session.token"))).toThrow(
      UnauthorizedException,
    );
  });

  it("accepte un token valide et attache le payload à la requête", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const payload = { sub: "1", email: "a@b.com", role: "ADMIN" };
    const jwtService = { verify: vi.fn().mockReturnValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    const request: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: "Bearer good.token" },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual(payload);
  });
});
