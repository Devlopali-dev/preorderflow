import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

// Commande créée par l'admin pour une campagne sans livraison : remise en main propre, aucun frais
// de port, et la livraison est refusée.

test("une campagne sans livraison donne une commande admin en main propre, sans frais de port", async ({
  page,
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const variantId = product.variants.find((v: { active: boolean }) => v.active).id;

  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Sans livraison ${stamp}`,
        slug: `sans-livraison-${stamp}`,
        productId: product.id,
        shippingEnabled: false,
      },
    })
  ).json();

  const base = {
    customerEmail: "playwright-sans-livraison@example.com",
    customerFirstName: "Sans",
    customerLastName: "Livraison",
    campaignId: campaign.id,
    items: [{ variantId, quantity: 2 }],
  };

  const res = await request.post(`${apiUrl}/api/v1/orders`, { headers: auth, data: base });
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order.deliveryMethod).toBe("PICKUP");
  expect(Number(order.shippingAmount)).toBe(0);
  expect(order.carrier).toBeNull();

  const refused = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: auth,
    data: { ...base, deliveryMethod: "SHIPPING" },
  });
  expect(refused.status()).toBe(400);
});
