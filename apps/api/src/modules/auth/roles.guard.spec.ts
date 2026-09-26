import { describe, expect, it, vi } from "vitest";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(user?: { role?: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("laisse passer si aucun rôle n'est requis", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "OPERATOR" }))).toBe(true);
  });

  it("laisse passer un rôle autorisé", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["ADMIN"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "ADMIN" }))).toBe(true);
  });

  it("refuse un rôle non autorisé", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["ADMIN"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: "OPERATOR" }))).toThrow();
  });

  it("refuse si aucun utilisateur n'est attaché à la requête", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["ADMIN"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow();
  });
});
