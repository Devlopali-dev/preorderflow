import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin, payOrder } from "./helpers";

// Remise en main propre : un clic depuis le tableau des commandes passe la commande à « Livrée »
// et crée l'expédition « Remise en main propre », sans étape expédiée.

test("la remise en main propre depuis le tableau livre la commande", async ({ page, request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");

  async function createOrder(email: string) {
    const res = await request.post(`${apiUrl}/api/v1/orders`, {
      headers: auth,
      data: {
        customerEmail: email,
        customerFirstName: "Main",
        customerLastName: "Propre",
        items: [
          {
            variantId: product.variants.find((v: { active: boolean }) => v.active).id,
            quantity: 1,
          },
        ],
        deliveryMethod: "PICKUP",
      },
    });
    return res.json();
  }

  async function setStatus(orderId: string, status: string) {
    await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, {
      headers: auth,
      data: { status },
    });
  }

  // Commande payée, en préparation.
  const order = await createOrder("playwright-handdelivery@example.com");
  await payOrder(request, token, order.id);
  await setStatus(order.id, "PROCESSING");

  await page.goto("/orders");
  const row = page.getByRole("row", { name: new RegExp(order.number) });
  await row.getByRole("button", { name: "Remise en main propre" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("row", { name: new RegExp(order.number) })).toHaveCount(1);
  await expect
    .poll(async () => {
      const res = await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth });
      return (await res.json()).status;
    })
    .toBe("DELIVERED");

  const delivered = await (
    await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })
  ).json();
  expect(delivered.fulfillmentStatus).toBe("DELIVERED");
  expect(delivered.shipment).toMatchObject({
    carrier: "Remise en main propre",
    status: "DELIVERED",
  });

  // Une commande non payée ne peut pas être remise en main propre.
  const unpaid = await createOrder("playwright-handdelivery-unpaid@example.com");
  await setStatus(unpaid.id, "PENDING_PAYMENT");
  const refused = await request.post(`${apiUrl}/api/v1/shipments/hand-delivery`, {
    headers: auth,
    data: { orderId: unpaid.id },
  });
  expect(refused.status()).toBe(400);
});
