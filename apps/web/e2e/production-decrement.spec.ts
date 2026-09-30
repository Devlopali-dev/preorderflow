import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Item {
  id: string;
  quantityProduced: number;
}

// Produit et lot dédiés : le stock et la production ne dépendent pas du seed.
async function setup(request: APIRequestContext, token: string) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `DEC-${stamp}`, name: `Décrément ${stamp}`, price: 1 },
    })
  ).json();
  const variantId = product.variants[0].id;
  const batch = await (
    await request.post(`${apiUrl}/api/v1/production/batches`, {
      headers: auth,
      data: { items: [{ variantId, quantityPlanned: 5 }] },
    })
  ).json();
  const itemId = batch.items[0].id;

  const complete = (quantityProduced: number) =>
    request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/complete`, {
      headers: auth,
      data: { items: [{ productionItemId: itemId, quantityProduced }] },
    });
  const decrement = (quantity?: number) =>
    request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/decrement`, {
      headers: auth,
      data: { productionItemId: itemId, quantity },
    });
  const start = () =>
    request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/start`, { headers: auth });
  const state = async () => {
    const current = await (
      await request.get(`${apiUrl}/api/v1/production/batches/${batch.id}`, { headers: auth })
    ).json();
    return {
      status: current.status as string,
      produced: (current.items as Item[])[0].quantityProduced,
    };
  };
  const physicalStock = async () =>
    (await (await request.get(`${apiUrl}/api/v1/inventory`, { headers: auth })).json()).find(
      (row: { product: { id: string } }) => row.product.id === product.id,
    ).stock.physicalStock as number;
  const movements = async () =>
    (await (
      await request.get(`${apiUrl}/api/v1/inventory/${variantId}/movements`, { headers: auth })
    ).json()) as Array<{ quantity: number; type: string; referenceType: string; reason: string }>;
  const archive = () =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });

  return {
    auth,
    product,
    variantId,
    batch,
    complete,
    decrement,
    start,
    state,
    physicalStock,
    movements,
    archive,
  };
}

test("retirer une unité produite corrige le lot et le stock par un mouvement négatif", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const t = await setup(request, token);

  // Un lot non démarré n'a rien produit : refus.
  expect((await t.decrement()).status()).toBe(400);

  await t.start();
  expect((await t.complete(3)).ok()).toBe(true);
  expect(await t.state()).toEqual({ status: "PARTIALLY_COMPLETED", produced: 3 });
  expect(await t.physicalStock()).toBe(3);

  // −1 par défaut : lot et stock baissent, le statut ne change pas.
  const res = await t.decrement();
  expect(res.status()).toBe(201);
  expect(await t.state()).toEqual({ status: "PARTIALLY_COMPLETED", produced: 2 });
  expect(await t.physicalStock()).toBe(2);

  // L'historique n'est pas réécrit : un mouvement négatif s'ajoute au mouvement de production.
  const movements = await t.movements();
  const correction = movements.find((m) => m.quantity === -1);
  expect(correction?.type).toBe("ADJUSTMENT_OUT");
  expect(correction?.referenceType).toBe("PRODUCTION_BATCH");
  expect(correction?.reason).toMatch(/Correction production/);
  expect(movements.some((m) => m.quantity === 3)).toBe(true);

  // Pas plus que ce qui a été produit, ni une quantité invalide.
  const tooMany = await t.decrement(5);
  expect(tooMany.status()).toBe(400);
  expect((await tooMany.json()).message).toMatch(/seulement 2/);
  expect((await t.decrement(0)).status()).toBe(400);
  expect(await t.state()).toEqual({ status: "PARTIALLY_COMPLETED", produced: 2 });

  // Un lot terminé est clos.
  expect((await t.complete(5)).ok()).toBe(true);
  expect((await t.state()).status).toBe("COMPLETED");
  const closed = await t.decrement();
  expect(closed.status()).toBe(400);
  expect((await closed.json()).message).toMatch(/lot en cours/);

  await t.archive();
});

test("le stock physique ne passe jamais sous zéro", async ({ request }) => {
  const token = await getAdminToken(request);
  const t = await setup(request, token);

  await t.start();
  await t.complete(2);

  // Les 2 unités ont déjà quitté le stock (casse) : les retirer de la production
  // ferait passer le stock physique sous zéro.
  const adjustment = await request.post(`${apiUrl}/api/v1/inventory/adjustments`, {
    headers: t.auth,
    data: { variantId: t.variantId, quantity: -2, reason: "Casse" },
  });
  expect(adjustment.ok()).toBe(true);
  expect(await t.physicalStock()).toBe(0);

  const res = await t.decrement();
  expect(res.status()).toBe(400);
  expect((await res.json()).message).toMatch(/Stock physique insuffisant/);
  expect((await t.state()).produced).toBe(2);

  await t.archive();
});

test("deux corrections simultanées ne retirent jamais plus que la production", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const t = await setup(request, token);
  await t.start();
  await t.complete(2);

  const responses = await Promise.all([t.decrement(), t.decrement(), t.decrement(), t.decrement()]);
  const succeeded = responses.filter((r) => r.status() === 201).length;

  expect(succeeded).toBe(2);
  expect(await t.state()).toMatchObject({ produced: 0 });
  expect(await t.physicalStock()).toBe(0);

  await t.archive();
});

test("le bouton −1 des actions de production corrige un lot en cours", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const t = await setup(request, token);
  await t.start();
  await t.complete(3);

  await page.goto("/production");
  const row = page.locator("tr", { hasText: t.product.name });
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(3)).toHaveText("3");

  await row.getByRole("button", { name: "Décrémenter de 1" }).click();
  await expect(row.locator("td").nth(3)).toHaveText("2");
  expect(await t.physicalStock()).toBe(2);

  // À zéro produit, plus rien à retirer.
  await t.decrement(2);
  await page.reload();
  await expect(row.getByRole("button", { name: "Décrémenter de 1" })).toBeDisabled();

  await t.archive();
});
