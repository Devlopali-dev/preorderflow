import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function createOrder(
  request: APIRequestContext,
  token: string,
  extra: Record<string, unknown> = {},
) {
  const auth = authHeader(token);
  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const res = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: auth,
    data: {
      customerEmail: `paiement-${stamp}@example.com`,
      customerFirstName: "Paiement",
      customerLastName: "Test",
      items: [
        { variantId: product.variants.find((v: { active: boolean }) => v.active).id, quantity: 1 },
      ],
      shippingAddress: {
        firstName: "Paiement",
        lastName: "Test",
        address1: "1 rue",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
      ...extra,
    },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createCampaign(
  request: APIRequestContext,
  token: string,
  extra: Record<string, unknown> = {},
) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `PAY-${stamp}`, name: `Paiement ${stamp}`, price: 3 },
    })
  ).json();
  const res = await request.post(`${apiUrl}/api/v1/campaigns`, {
    headers: auth,
    data: {
      name: `Campagne paiement ${stamp}`,
      slug: `paiement-${stamp}`,
      productId: product.id,
      ...extra,
    },
  });
  return { response: res, product };
}

test("un paiement en espèces se génère puis se confirme comme les autres", async ({ request }) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const order = await createOrder(request, token);

  const created = await request.post(`${apiUrl}/api/v1/orders/${order.id}/payments`, {
    headers: auth,
    data: { provider: "CASH" },
  });
  expect(created.status()).toBe(201);
  const payment = await created.json();
  expect(payment.provider).toBe("CASH");
  expect(payment.metadata).toBeNull(); // pas de lien pour de l'argent liquide

  const confirmed = await request.post(`${apiUrl}/api/v1/payments/${payment.id}/confirm`, {
    headers: auth,
  });
  expect(confirmed.ok()).toBe(true);
  const after = await (
    await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })
  ).json();
  expect(after.status).toBe("PAID");
  expect(after.paymentStatus).toBe("PAID");
});

test("le lien Revolut met le montant en centimes, celui de la campagne a priorité sur le .env", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const pay = async (orderId: string) =>
    (
      await (
        await request.post(`${apiUrl}/api/v1/orders/${orderId}/payments`, {
          headers: auth,
          data: { provider: "MANUAL" },
        })
      ).json()
    ).metadata.paymentLink as string;

  // Sans campagne : lien du .env, montant du stylo (3 €) en centimes.
  const plain = await createOrder(request, token);
  const link = await pay(plain.id);
  expect(link).toContain("revolut.me/");
  expect(link).toMatch(new RegExp(`[?&]amount=${Math.round(Number(plain.total) * 100)}$`));

  // Avec une campagne qui porte son propre lien.
  const { response } = await createCampaign(request, token, {
    paymentLink: "https://revolut.me/autre-compte?currency=EUR&amount=",
  });
  expect(response.status()).toBe(201);
  const campaign = await response.json();
  expect(campaign.paymentLink).toBe("https://revolut.me/autre-compte?currency=EUR&amount=");

  const order = await createOrder(request, token, { campaignId: campaign.id });
  expect(await pay(order.id)).toBe(
    `https://revolut.me/autre-compte?currency=EUR&amount=${Math.round(Number(order.total) * 100)}`,
  );
});

test("le lien de paiement d'une campagne est validé et peut être effacé", async ({ request }) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);

  const invalid = await createCampaign(request, token, { paymentLink: "pas un lien" });
  expect(invalid.response.status()).toBe(400);

  const { response } = await createCampaign(request, token, {
    paymentLink: "https://pay.example.com/boutique",
  });
  const campaign = await response.json();

  const cleared = await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
    data: { paymentLink: null },
  });
  expect(cleared.ok()).toBe(true);
  expect((await cleared.json()).paymentLink).toBeNull();

  // Une commande ne peut pas viser une campagne inexistante.
  const ghost = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: auth,
    data: { customerEmail: "x@example.com", campaignId: "00000000-0000-4000-8000-000000000000" },
  });
  expect(ghost.status()).toBe(400);
});

test("la modale d'une campagne propose le lien de paiement avec son QR code, et l'enregistre", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const { response } = await createCampaign(request, token);
  const campaign = await response.json();

  await page.goto("/campaigns");
  await page.getByRole("button", { name: campaign.name, exact: true }).click();
  const dialog = page.getByRole("dialog");

  const field = dialog.getByLabel("Lien de paiement (optionnel)");
  await expect(field).toHaveValue("");
  await expect(dialog.getByAltText("QR code du lien de paiement")).toHaveCount(0);

  await field.fill("https://revolut.me/test-campagne?currency=EUR&amount=");
  await expect(dialog.getByAltText("QR code du lien de paiement")).toBeVisible();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toHaveCount(0);

  const saved = await (
    await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}`, { headers: authHeader(token) })
  ).json();
  expect(saved.paymentLink).toBe("https://revolut.me/test-campagne?currency=EUR&amount=");
});

test("les termes de paiement sont en français : tableau des commandes et panneau de paiement", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const order = await createOrder(request, token);

  await page.goto("/orders");
  const row = page.locator("tr", { hasText: order.number });
  await expect(row.getByText("Non payée")).toBeVisible();
  await expect(row.getByText("UNPAID")).toHaveCount(0);

  // Panneau de paiement : « Espèces » proposé, règlement affiché en français une fois la commande annulée.
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("option", { name: "Espèces" })).toHaveCount(1);
  await page.getByRole("combobox").selectOption("CASH");
  await page.getByRole("button", { name: "Générer le paiement" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme payée" })).toBeVisible();

  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
    headers: auth,
    data: { status: "CANCELLED" },
  });
  await page.reload();
  await expect(page.getByText(/Espèces — .* — en attente/)).toBeVisible();
});
