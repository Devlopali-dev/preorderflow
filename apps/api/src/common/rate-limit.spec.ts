import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_MESSAGE,
  parseTrustProxy,
  rateLimitDisabled,
  throttlerModuleOptions,
} from "./rate-limit";

describe("parseTrustProxy", () => {
  it("par défaut aucun proxy de confiance : l'en-tête X-Forwarded-For est ignoré", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("  ")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
  });

  it("un nombre = nombre de proxys, `true` ne fait jamais confiance à tout l'en-tête", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("true")).toBe(1);
  });

  it("une liste d'adresses, de plages ou de noms", () => {
    expect(parseTrustProxy("loopback, 10.0.0.0/8")).toEqual(["loopback", "10.0.0.0/8"]);
    expect(parseTrustProxy("172.18.0.2")).toEqual(["172.18.0.2"]);
  });
});

describe("throttlerModuleOptions", () => {
  it("100 requêtes par minute par défaut, avec un message en français", () => {
    const options = throttlerModuleOptions({});
    expect(options).toMatchObject({
      throttlers: [{ name: "default", ttl: 60_000, limit: 100 }],
      errorMessage: RATE_LIMIT_MESSAGE,
    });
    expect(RATE_LIMIT_MESSAGE).toMatch(/Trop de requêtes/);
  });

  it("RATE_LIMIT_DISABLED=true coupe les limites, toute autre valeur les laisse actives", () => {
    const skip = (env: NodeJS.ProcessEnv) =>
      (throttlerModuleOptions(env) as unknown as { skipIf: () => boolean }).skipIf();
    expect(skip({ RATE_LIMIT_DISABLED: "true" })).toBe(true);
    expect(skip({ RATE_LIMIT_DISABLED: "false" })).toBe(false);
    expect(skip({ RATE_LIMIT_DISABLED: "1" })).toBe(false);
    expect(skip({})).toBe(false);
    expect(rateLimitDisabled({ RATE_LIMIT_DISABLED: "true" })).toBe(true);
  });
});
