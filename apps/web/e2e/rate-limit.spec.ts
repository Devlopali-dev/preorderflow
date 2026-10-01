import { test, expect, type APIRequestContext } from "@playwright/test";

// Limites de débit sur les VRAIES routes. La suite tourne avec `RATE_LIMIT_DISABLED=true` (sinon ses
// propres appels dépasseraient les seuils) : ces tests visent donc une seconde API, démarrée SANS
// cette variable, dont l'URL est dans RATE_LIMIT_API_URL (la CI la lance sur un autre port). Sans
// elle, ils sont ignorés.
const limitedApi = process.env.RATE_LIMIT_API_URL;

test.describe("limites de débit (API avec limites actives)", () => {
  test.skip(!limitedApi, "RATE_LIMIT_API_URL absent : aucune API avec limites actives");

  // Un identifiant de campagne inexistant et un corps vide : la route répond 400 (validation)
  // ou 404, mais la requête est comptée — le garde passe avant tout le reste.
  const ghost = "00000000-0000-4000-8000-000000000000";

  async function hit(
    request: APIRequestContext,
    path: string,
    count: number,
    data: object = {},
    headers: Record<string, string> = {},
  ) {
    const responses = [];
    for (let i = 0; i < count; i += 1) {
      responses.push(await request.post(`${limitedApi}${path}`, { data, headers }));
    }
    return responses;
  }

  const routes = [
    {
      name: "login",
      path: "/api/v1/auth/login",
      limit: 10,
      data: { email: "rate@example.com", password: "mauvais" },
    },
    {
      name: "lien magique",
      path: "/api/v1/customer/auth/magic-link",
      limit: 5,
      data: { email: "rate-inconnu@example.com" },
    },
    {
      name: "recensement public",
      path: `/api/v1/campaigns/${ghost}/interests`,
      limit: 5,
      data: {},
    },
    { name: "commande publique", path: `/api/v1/campaigns/${ghost}/orders`, limit: 5, data: {} },
  ];

  for (const route of routes) {
    test(`${route.name} : refusé (429) au-delà de ${route.limit} requêtes par minute`, async ({
      playwright,
    }) => {
      const request = await playwright.request.newContext();
      const responses = await hit(request, route.path, route.limit + 1, route.data);
      const statuses = responses.map((response) => response.status());

      // Les premières passent (toute réponse sauf 429), la suivante est refusée.
      expect(statuses.slice(0, route.limit).every((status) => status !== 429)).toBe(true);
      expect(statuses[route.limit]).toBe(429);

      const refused = responses[route.limit]!;
      expect(refused.headers()["retry-after"]).toBeTruthy();
      expect(JSON.stringify(await refused.json())).toContain("Trop de requêtes");
      await request.dispose();
    });
  }

  test("falsifier X-Forwarded-For ne contourne pas la limite (aucun proxy de confiance)", async ({
    playwright,
  }) => {
    const request = await playwright.request.newContext();
    // Limite atteinte avec l'IP réelle…
    await hit(request, `/api/v1/campaigns/${ghost}/interests`, 5);
    // …une IP inventée dans l'en-tête n'y change rien.
    const [spoofed] = await hit(
      request,
      `/api/v1/campaigns/${ghost}/interests`,
      1,
      {},
      {
        "X-Forwarded-For": "203.0.113.77",
      },
    );
    expect(spoofed!.status()).toBe(429);
    await request.dispose();
  });

  test("les routes ordinaires ne sont pas touchées par les limites strictes", async ({
    playwright,
  }) => {
    const request = await playwright.request.newContext();
    for (let i = 0; i < 12; i += 1) {
      expect((await request.get(`${limitedApi}/health`)).status()).toBe(200);
    }
    await request.dispose();
  });
});
