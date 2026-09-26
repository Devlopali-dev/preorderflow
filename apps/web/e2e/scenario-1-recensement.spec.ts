import { test, expect } from "@playwright/test";

// Scénario 1 du cahier des charges (§29) :
// Créer campagne -> Publier campagne -> Créer intérêt -> Vérifier statistiques

test("scénario 1 : campagne, recensement, statistiques", async ({ page, request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const products = await (await request.get(`${apiUrl}/api/v1/products`)).json();
  const product = products.find((p: { sku: string }) => p.sku === "SIFFLET-001");

  const slug = `scenario1-${Date.now()}`;

  // 1. Créer campagne (DRAFT)
  const createRes = await request.post(`${apiUrl}/api/v1/campaigns`, {
    data: {
      name: "Scénario 1 — Campagne de test",
      slug,
      description: "Campagne créée par le scénario e2e 1.",
      productId: product.id,
      indicativePrice: 5,
    },
  });
  expect(createRes.ok()).toBe(true);
  const campaign = await createRes.json();
  expect(campaign.status).toBe("DRAFT");

  // 2. Publier campagne (DRAFT -> RECENSEMENT)
  const publishRes = await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
    data: { status: "RECENSEMENT" },
  });
  expect(publishRes.ok()).toBe(true);
  expect((await publishRes.json()).status).toBe("RECENSEMENT");

  // 3. Créer intérêt via le formulaire public réel (UI, pas l'API)
  await page.goto(`/campaigns/${slug}`);
  await expect(page.getByRole("heading", { name: "Scénario 1 — Campagne de test" })).toBeVisible();

  await page.getByLabel("Combien souhaitez-vous en obtenir ?").fill("3");
  await page.getByLabel("Email").fill("scenario1@example.com");
  await page.getByLabel("Prénom").fill("Scenario");
  await page.getByLabel("Nom", { exact: true }).fill("Un");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Je participe au recensement" }).click();

  await expect(page.getByText(/bien été enregistré/)).toBeVisible();

  // 4. Vérifier les statistiques
  const statsRes = await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}/statistics`);
  const stats = await statsRes.json();
  expect(stats.totalInterests).toBe(1);
  expect(stats.totalQuantity).toBe(3);
  expect(stats.distribution.find((b: { quantity: unknown }) => b.quantity === "5+")?.count).toBe(0);
});
