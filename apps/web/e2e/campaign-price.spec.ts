import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

test("le prix de la page publique est celui du produit, et la campagne n'a plus de prix propre", async ({
  page,
  request,
}) => {
  const auth = authHeader(await getAdminToken(request));
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `PRICE-${stamp}`, name: `Prix ${stamp}`, price: 12.5 },
    })
  ).json();
  const slug = `prix-${stamp}`;
  const create = (extra: Record<string, unknown> = {}) =>
    request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: { name: `Campagne prix ${stamp}`, slug, productId: product.id, ...extra },
    });

  // L'ancien champ est refusé (ValidationPipe en forbidNonWhitelisted).
  const legacy = await create({ indicativePrice: 3 });
  expect(legacy.status()).toBe(400);

  const campaign = await (await create()).json();
  expect(campaign.indicativePrice).toBeUndefined();
  await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
    headers: auth,
    data: { status: "RECENSEMENT" },
  });

  await page.goto(`/campaigns/${slug}`);
  await expect(page.getByText(/Prix indicatif : 12\.5\d* EUR/)).toBeVisible();

  // Modifier le prix du produit met la page publique à jour.
  const update = await request.patch(`${apiUrl}/api/v1/products/${product.id}`, {
    headers: auth,
    data: { price: 14 },
  });
  expect(update.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText(/Prix indicatif : 14(\.0+)? EUR/)).toBeVisible();

  await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
    headers: auth,
    data: { status: "ANNULEE" },
  });
  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
});
