import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Controller, Get } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { afterAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { RATE_LIMIT_MESSAGE, throttlerModuleOptions } from "./rate-limit";

@Controller("limited")
class LimitedController {
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get("strict")
  strict() {
    return { ok: true };
  }

  @Get("open")
  open() {
    return { ok: true };
  }
}

// Vrai serveur HTTP : le garde est monté comme dans l'application (APP_GUARD + les mêmes options).
async function boot(
  env: NodeJS.ProcessEnv,
  trustProxy?: number,
): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot(throttlerModuleOptions(env))],
    controllers: [LimitedController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();
  const app = moduleRef.createNestApplication();
  if (trustProxy !== undefined) {
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set(
      "trust proxy",
      trustProxy,
    );
  }
  await app.listen(0);
  return { app, url: await app.getUrl() };
}

const statuses = async (url: string, n: number, headers: Record<string, string> = {}) => {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push((await fetch(url, { headers })).status);
  return out;
};

describe("limites de débit — serveur réel", () => {
  const apps: INestApplication[] = [];
  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it("une route sensible refuse (429) au-delà de sa limite, avec Retry-After et un message en français", async () => {
    const { app, url } = await boot({});
    apps.push(app);
    expect(await statuses(`${url}/limited/strict`, 4)).toEqual([200, 200, 200, 429]);

    const refused = await fetch(`${url}/limited/strict`);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBeTruthy();
    expect(JSON.stringify(await refused.json())).toContain(RATE_LIMIT_MESSAGE);
    // La limite est propre à la route : une autre route n'est pas touchée.
    expect((await fetch(`${url}/limited/open`)).status).toBe(200);
  });

  it("sans proxy de confiance, falsifier X-Forwarded-For ne contourne pas la limite", async () => {
    const { app, url } = await boot({});
    apps.push(app);
    const spoofed = ["203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"].map((ip) => ({
      "X-Forwarded-For": ip,
    }));
    const results: number[] = [];
    for (const headers of spoofed)
      results.push((await fetch(`${url}/limited/strict`, { headers })).status);
    expect(results).toEqual([200, 200, 200, 429]);
  });

  it("derrière un proxy de confiance, chaque visiteur a sa propre limite", async () => {
    const { app, url } = await boot({}, 1);
    apps.push(app);
    // Visiteur A épuise sa limite ; visiteur B (autre IP dans X-Forwarded-For) n'est pas touché.
    expect(
      await statuses(`${url}/limited/strict`, 4, { "X-Forwarded-For": "198.51.100.1" }),
    ).toEqual([200, 200, 200, 429]);
    expect(
      await statuses(`${url}/limited/strict`, 1, { "X-Forwarded-For": "198.51.100.2" }),
    ).toEqual([200]);
  });

  it("RATE_LIMIT_DISABLED=true : plus aucune limite", async () => {
    const { app, url } = await boot({ RATE_LIMIT_DISABLED: "true" });
    apps.push(app);
    expect(await statuses(`${url}/limited/strict`, 6)).toEqual([200, 200, 200, 200, 200, 200]);
  });
});

describe("AppModule", () => {
  it("enregistre ThrottlerGuard comme garde global (sans lui, aucun @Throttle ne s'applique)", () => {
    const providers = (Reflect.getMetadata("providers", AppModule) ?? []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    expect(
      providers.some(
        (provider) => provider.provide === APP_GUARD && provider.useClass === ThrottlerGuard,
      ),
    ).toBe(true);
  });
});
