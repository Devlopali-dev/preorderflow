import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

// Régression : le numéro de commande était calculé hors transaction, donc deux
// créations simultanées lisaient le même MAX et la seconde échouait en 500
// (unicité de `number`). Les specs qui créent des commandes tournent en
// parallèle : ce cas doit toujours passer.
test("des commandes créées en même temps reçoivent chacune un numéro unique", async ({
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const auth = authHeader(await getAdminToken(request));

  const products = await (await request.get(`${apiUrl}/api/v1/products`)).json();
  const product = products.find((p: { sku: string }) => p.sku === "GOURDE-001");
  const stamp = Date.now();

  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      request.post(`${apiUrl}/api/v1/orders`, {
        headers: auth,
        data: {
          customerEmail: `numbering-${stamp}-${i}@example.com`,
          customerFirstName: "Numerotation",
          customerLastName: String(i),
          items: [{ variantId: product.variants[0].id, quantity: 1 }],
          shippingAddress: {
            firstName: "Numerotation",
            lastName: String(i),
            address1: "1 rue",
            postalCode: "75000",
            city: "Paris",
            country: "FR",
          },
        },
      }),
    ),
  );

  expect(responses.map((r) => r.status())).toEqual([201, 201, 201, 201, 201, 201]);
  const orders = await Promise.all(responses.map((r) => r.json()));
  const numbers = orders.map((o: { number: string }) => o.number);
  expect(new Set(numbers).size).toBe(numbers.length);
  for (const number of numbers) {
    expect(number).toMatch(/^\d{4}-\d{4,}$/);
  }

  // Nettoyage : ces commandes DRAFT ne doivent pas polluer les futurs runs.
  for (const order of orders) {
    await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status: "CANCELLED" },
    });
  }
});
