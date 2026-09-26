import { test, expect } from "@playwright/test";

// Scénario 3 du cahier des charges (§29) :
// Commande payée -> Préparation -> Expédition -> Tracking -> Livraison

test("scénario 3 : préparation, expédition, tracking, livraison", async ({ page, request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const products = await (await request.get(`${apiUrl}/api/v1/products`)).json();
  const product = products.find((p: { sku: string }) => p.sku === "SIFFLET-001");

  // Commande payée (setup direct par API — pas l'objet du scénario)
  const orderRes = await request.post(`${apiUrl}/api/v1/orders`, {
    data: {
      customerEmail: "scenario3@example.com",
      customerFirstName: "Scenario",
      customerLastName: "Trois",
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: {
        firstName: "Scenario",
        lastName: "Trois",
        address1: "3 rue du Test",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();
  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, { data: { status: "PENDING_PAYMENT" } });
  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, { data: { status: "PAID" } });

  await page.goto(`/orders/${order.id}`);

  // Préparation
  await page.getByRole("button", { name: "Marquer en préparation" }).click();
  await expect(page.getByRole("button", { name: "Marquer prête à expédier" })).toBeVisible();
  await page.getByRole("button", { name: "Marquer prête à expédier" }).click();

  // Expédition (avec tracking)
  await page.getByPlaceholder("Numéro de suivi").fill("TRACK-SCENARIO-3");
  await page.getByPlaceholder("URL de suivi").fill("https://track.example.com/TRACK-SCENARIO-3");
  await page.getByRole("button", { name: "Créer l'expédition" }).click();

  // Tracking visible
  await expect(page.getByText("TRACK-SCENARIO-3")).toBeVisible();
  await expect(page.getByRole("link", { name: "Suivre le colis" })).toHaveAttribute(
    "href",
    "https://track.example.com/TRACK-SCENARIO-3",
  );

  await page.getByRole("button", { name: "Marquer comme expédiée" }).click();
  await expect(page.getByRole("button", { name: "Marquer en transit" })).toBeVisible();
  const shippedOrderRes = await request.get(`${apiUrl}/api/v1/orders/${order.id}`);
  expect((await shippedOrderRes.json()).status).toBe("SHIPPED");

  await page.getByRole("button", { name: "Marquer en transit" }).click();
  await expect(page.getByRole("button", { name: "Marquer livrée" })).toBeVisible();

  // Livraison
  await page.getByRole("button", { name: "Marquer livrée" }).click();
  await expect(page.getByText("Statut expédition : DELIVERED")).toBeVisible();

  const deliveredOrderRes = await request.get(`${apiUrl}/api/v1/orders/${order.id}`);
  const deliveredOrder = await deliveredOrderRes.json();
  expect(deliveredOrder.status).toBe("DELIVERED");
  expect(deliveredOrder.fulfillmentStatus).toBe("DELIVERED");
});
