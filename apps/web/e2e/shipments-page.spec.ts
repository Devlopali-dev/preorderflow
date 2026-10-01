import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin, payOrder } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

test("les expéditions sont groupées par statut, avec une action pour passer au suivant", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();

  // Expédition dédiée : commande prête à expédier, puis colis créé par l'API.
  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const order = await (
    await request.post(`${apiUrl}/api/v1/orders`, {
      headers: auth,
      data: {
        customerEmail: `shipments-${stamp}@example.com`,
        customerFirstName: "Exp",
        customerLastName: "Edition",
        items: [
          {
            variantId: product.variants.find((v: { active: boolean }) => v.active).id,
            quantity: 1,
          },
        ],
        shippingAddress: {
          firstName: "Exp",
          lastName: "Edition",
          address1: "1 rue",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
      },
    })
  ).json();
  await payOrder(request, token, order.id);
  for (const status of ["PROCESSING", "READY_TO_SHIP"]) {
    await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status },
    });
  }
  const shipment = await (
    await request.post(`${apiUrl}/api/v1/shipments`, {
      headers: auth,
      data: { orderId: order.id, trackingNumber: `TRK-${stamp}` },
    })
  ).json();

  const row = () => page.locator("tr", { hasText: order.number });
  const statusOf = async () =>
    (await (await request.get(`${apiUrl}/api/v1/shipments`, { headers: auth })).json()).find(
      (s: { id: string }) => s.id === shipment.id,
    ).status;

  // PENDING : une action pour passer au statut suivant.
  await page.goto("/shipments");
  await expect(row().getByRole("button", { name: "Marquer étiquette créée" })).toBeVisible();
  // Groupes, badges et confirmation sont en français, sans code anglais.
  await expect(page.locator("main")).not.toContainText(/\b(PENDING|LABEL_CREATED|IN_TRANSIT)\b/);
  await expect(page.locator("#main, main").getByText("En attente").first()).toBeVisible();
  await row().getByRole("button", { name: "Marquer étiquette créée" }).click();
  await expect(page.getByText("Passer au statut Étiquette créée ?")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(row().getByRole("button", { name: "Marquer expédié" })).toBeVisible();
  expect(await statusOf()).toBe("LABEL_CREATED");

  // Un incident ne se signale qu'une fois le colis parti.
  await expect(row().getByRole("button", { name: "Signaler un incident" })).toHaveCount(0);
  await row().getByRole("button", { name: "Marquer expédié" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(row().getByRole("button", { name: "Signaler un incident" })).toBeVisible();

  // DELIVERED : plus aucune action, et la colonne Actions disparaît du groupe.
  for (const status of ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]) {
    const res = await request.patch(`${apiUrl}/api/v1/shipments/${shipment.id}/status`, {
      headers: auth,
      data: { status },
    });
    expect(res.ok()).toBe(true);
  }
  await page.reload();
  await expect(row()).toBeVisible();
  await expect(row().getByRole("button")).toHaveCount(0);
  await expect(
    page.locator("table", { has: row() }).getByRole("columnheader", { name: "Actions" }),
  ).toHaveCount(0);
});
