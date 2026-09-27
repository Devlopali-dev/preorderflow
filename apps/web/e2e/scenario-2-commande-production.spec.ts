import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

// Scénario 2 du cahier des charges (§29) :
// Créer commande -> Payer -> Créer production -> Terminer production -> Vérifier stock

test("scénario 2 : commande, paiement, production, stock", async ({ page, request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "GOURDE-001");

  const stockBeforeRes = await request.get(`${apiUrl}/api/v1/inventory`, { headers: auth });
  const rowBefore = (await stockBeforeRes.json()).find(
    (r: { product: { id: string } }) => r.product.id === product.id,
  ).stock;
  const stockBefore = rowBefore.physicalStock;
  const reservedBefore = rowBefore.reservedStock;

  // 1. Créer commande
  const orderRes = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: auth,
    data: {
      customerEmail: "scenario2@example.com",
      customerFirstName: "Scenario",
      customerLastName: "Deux",
      items: [{ productId: product.id, quantity: 2 }],
      shippingAddress: {
        firstName: "Scenario",
        lastName: "Deux",
        address1: "2 rue du Test",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();

  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
    headers: auth,
    data: { status: "PENDING_PAYMENT" },
  });

  // 2. Payer — via l'interface admin réelle (génération + confirmation)
  await page.goto(`/orders/${order.id}`);
  await page.getByRole("button", { name: "Générer le paiement" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme payée" })).toBeVisible();
  await page.getByRole("button", { name: "Marquer comme payée" }).click();
  await expect(page.getByText(/Paiement reçu/)).toBeVisible();

  const paidOrderRes = await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth });
  expect((await paidOrderRes.json()).status).toBe("PAID");

  // 3. Créer production
  const batchRes = await request.post(`${apiUrl}/api/v1/production/batches`, {
    headers: auth,
    data: {
      reference: `SCENARIO2-${Date.now()}`,
      items: [{ productId: product.id, quantityPlanned: 10 }],
    },
  });
  const batch = await batchRes.json();
  await request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/start`, { headers: auth });

  // 4. Terminer production
  const completeRes = await request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/complete`, {
    headers: auth,
    data: { items: [{ productionItemId: batch.items[0].id, quantityProduced: 10 }] },
  });
  expect((await completeRes.json()).status).toBe("COMPLETED");

  // 5. Vérifier le stock (physique augmenté de 10, jamais confondu avec les
  // 2 unités commandées — cf. §14 du cahier des charges)
  await page.goto("/inventory");
  const inventoryAfterRes = await request.get(`${apiUrl}/api/v1/inventory`, { headers: auth });
  const rowAfter = (await inventoryAfterRes.json()).find(
    (r: { product: { id: string } }) => r.product.id === product.id,
  );
  expect(rowAfter.stock.physicalStock).toBe(stockBefore + 10);
  expect(rowAfter.stock.reservedStock).toBe(reservedBefore + 2);
  expect(rowAfter.stock.availableStock).toBe(stockBefore + 10 - (reservedBefore + 2));

  // Nettoyage : cette commande PAID ne doit pas polluer les futurs runs
  // (elle resterait sinon comptée dans reservedStock indéfiniment).
  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
    headers: auth,
    data: { status: "REFUNDED" },
  });
});
