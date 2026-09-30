import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

test("l'admin peut choisir Stripe comme mode de paiement (erreur propre si non configuré)", async ({
  page,
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const token = await loginAsAdmin(page, request);

  const products = await (
    await request.get(`${apiUrl}/api/v1/products`, { headers: authHeader(token) })
  ).json();
  const product = products.find((p: { sku: string }) => p.sku === "SIFFLET-001");

  const orderRes = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: authHeader(token),
    data: {
      customerEmail: "playwright-stripe@example.com",
      customerFirstName: "Playwright",
      customerLastName: "Stripe",
      items: [{ variantId: product.variants[0].id, quantity: 1 }],
      shippingAddress: {
        firstName: "Playwright",
        lastName: "Stripe",
        address1: "1 rue",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();

  await page.goto(`/orders/${order.id}`);
  await page.getByRole("combobox").selectOption("STRIPE");
  await page.getByRole("button", { name: "Générer le paiement" }).click();

  // Sans STRIPE_SECRET_KEY configurée dans cet environnement, l'API refuse
  // proprement (400) plutôt que de planter — c'est le comportement réel
  // attendu tant que l'admin n'a pas branché ses clés Stripe.
  await expect(page.getByText(/Stripe n'est pas configuré/)).toBeVisible();
});
