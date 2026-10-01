import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

// Scénario 1 du cahier des charges (§29) :
// Créer campagne -> Publier campagne -> Créer intérêt -> Vérifier statistiques

test("scénario 1 : campagne, recensement, statistiques", async ({ page, request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const auth = authHeader(await getAdminToken(request));

  // Produit dédié à ce scénario, avec deux couleurs de la palette : le test ne
  // dépend pas de l'état des variantes du seed (qu'on peut désactiver à la main).
  const colors = (await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json())
    .filter((c: { active: boolean }) => c.active)
    .slice(0, 2) as Array<{ id: string; name: string }>;
  expect(colors).toHaveLength(2);
  const [first, second] = colors;

  const stamp = Date.now();
  const productRes = await request.post(`${apiUrl}/api/v1/products`, {
    headers: auth,
    data: {
      sku: `S1-${stamp}`,
      name: `Produit scénario 1 ${stamp}`,
      slug: `s1-${stamp}`,
      price: 5,
    },
  });
  expect(productRes.ok()).toBe(true);
  const product = await productRes.json();
  for (const color of colors) {
    const variantRes = await request.post(`${apiUrl}/api/v1/products/${product.id}/variants`, {
      headers: auth,
      data: { colorId: color.id },
    });
    expect(variantRes.ok()).toBe(true);
  }

  const slug = `scenario1-${stamp}`;

  // 1. Créer campagne (DRAFT) — action admin
  const createRes = await request.post(`${apiUrl}/api/v1/campaigns`, {
    headers: auth,
    data: {
      name: "Scénario 1 — Campagne de test",
      slug,
      description: "Campagne créée par le scénario e2e 1.",
      productId: product.id,
    },
  });
  expect(createRes.ok()).toBe(true);
  const campaign = await createRes.json();
  expect(campaign.status).toBe("DRAFT");

  // 2. Publier campagne (DRAFT -> RECENSEMENT) — action admin
  const publishRes = await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
    headers: auth,
    data: { status: "RECENSEMENT" },
  });
  expect(publishRes.ok()).toBe(true);
  expect((await publishRes.json()).status).toBe("RECENSEMENT");

  // 3. Créer intérêt via le formulaire public réel (UI, pas l'API) — public,
  // aucune authentification requise
  await page.goto(`/campaigns/${slug}`);
  await expect(page.getByRole("heading", { name: "Scénario 1 — Campagne de test" })).toBeVisible();

  // 2 de la première couleur + 1 de la seconde : une personne, deux couleurs.
  const addFirst = page.getByRole("button", { name: `Ajouter un exemplaire : ${first.name}` });
  await addFirst.click();
  await addFirst.click();
  await page.getByRole("button", { name: `Ajouter un exemplaire : ${second.name}` }).click();
  await page.getByLabel("Email").fill("scenario1@example.com");
  await page.getByLabel("Prénom").fill("Scenario");
  await page.getByLabel("Nom", { exact: true }).fill("Un");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Je participe au recensement" }).click();

  await expect(page.getByText(/bien été enregistré/)).toBeVisible();

  // 4. Vérifier les statistiques (lecture publique)
  const statsRes = await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}/statistics`);
  const stats = await statsRes.json();
  expect(stats.totalInterests).toBe(1);
  expect(stats.totalQuantity).toBe(3);
  expect(stats.distribution.find((b: { quantity: unknown }) => b.quantity === "5+")?.count).toBe(0);
  // La personne compte une fois au total, et une fois par couleur demandée.
  expect(stats.distribution.find((b: { quantity: unknown }) => b.quantity === 3)?.count).toBe(1);
  const quantityByColor = Object.fromEntries(
    stats.byVariant.map((v: { label: string; quantity: number }) => [v.label, v.quantity]),
  );
  expect(quantityByColor).toEqual({ [first.name]: 2, [second.name]: 1 });

  // Nettoyage : le produit de test sort de la liste des produits actifs.
  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
});
