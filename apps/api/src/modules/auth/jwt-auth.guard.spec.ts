import { describe, expect, it, vi } from "vitest";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AdminSessionService } from "./admin-session.service";

function makeContext(authorization?: string, request: object = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization }, ...request }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(options: {
  isPublic?: boolean;
  verify?: ReturnType<typeof vi.fn>;
  admin?: { id: string; role: "ADMIN" | "OPERATOR" } | null;
}) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.isPublic ?? false),
  } as unknown as Reflector;
  const jwtService = { verify: options.verify ?? vi.fn() } as unknown as JwtService;
  const findActive = vi.fn().mockResolvedValue(options.admin === undefined ? null : options.admin);
  const admins = { findActive } as unknown as AdminSessionService;
  return { guard: new JwtAuthGuard(jwtService, reflector, admins), jwtService, findActive };
}

describe("JwtAuthGuard", () => {
  it("laisse passer une route @Public() sans vérifier de token ni interroger la base", async () => {
    const { guard, jwtService, findActive } = makeGuard({ isPublic: true });

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
    expect(findActive).not.toHaveBeenCalled();
  });

  it("refuse sans en-tête Authorization", async () => {
    const { guard } = makeGuard({});

    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it("refuse un en-tête mal formé (pas de préfixe Bearer)", async () => {
    const { guard } = makeGuard({});

    await expect(guard.canActivate(makeContext("token-sans-bearer"))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("refuse un token que jwtService rejette (expiré/invalide), sans interroger la base", async () => {
    const verify = vi.fn().mockImplementation(() => {
      throw new Error("invalid");
    });
    const { guard, findActive } = makeGuard({ verify });

    await expect(guard.canActivate(makeContext("Bearer bad.token.here"))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActive).not.toHaveBeenCalled();
  });

  it("refuse un token valide mais sans rôle admin (ex: session client) — régression réelle", async () => {
    // Un token client (customer-auth) est signé avec le même secret
    // applicatif que les tokens admin ; sans cette vérification du rôle,
    // il passait ce guard et donnait accès à toute route admin dépourvue
    // de @Roles() explicite. Trouvé en testant l'espace client en réel.
    const verify = vi.fn().mockReturnValue({ sub: "customer-1", type: "customer" });
    const { guard, findActive } = makeGuard({ verify });

    await expect(guard.canActivate(makeContext("Bearer customer.session.token"))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActive).not.toHaveBeenCalled();
  });

  it("refuse un token valide dont le compte admin n'existe plus ou est désactivé", async () => {
    // Régression : après une réinitialisation de la base, un ancien cookie de
    // session (signature valide) pointait vers un admin supprimé. Les routes
    // qui lisent le profil plantaient en 500, celles qui écrivent dans l'audit
    // (clé étrangère) aussi, et un admin désactivé gardait son accès.
    const verify = vi.fn().mockReturnValue({ sub: "supprime", email: "a@b.com", role: "ADMIN" });
    const { guard, findActive } = makeGuard({ verify, admin: null });

    await expect(guard.canActivate(makeContext("Bearer good.token"))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActive).toHaveBeenCalledWith("supprime");
  });

  it("accepte un token valide et attache le payload à la requête", async () => {
    const payload = { sub: "1", email: "a@b.com", role: "ADMIN" };
    const verify = vi.fn().mockReturnValue(payload);
    const { guard } = makeGuard({ verify, admin: { id: "1", role: "ADMIN" } });

    const request: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: "Bearer good.token" },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  it("prend le rôle en base, pas celui du token : un admin rétrogradé perd ses droits tout de suite", async () => {
    const verify = vi.fn().mockReturnValue({ sub: "1", email: "a@b.com", role: "ADMIN" });
    const { guard } = makeGuard({ verify, admin: { id: "1", role: "OPERATOR" } });

    const request: { headers: { authorization: string }; user?: { role: string } } = {
      headers: { authorization: "Bearer good.token" },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);
    expect(request.user?.role).toBe("OPERATOR");
  });
});
