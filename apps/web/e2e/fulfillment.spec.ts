import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

test("le détail d'une commande permet de la préparer, l'expédier et la livrer", async ({
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
      customerEmail: "playwright-fulfillment@example.com",
      customerFirstName: "Playwright",
      customerLastName: "Fulfillment",
      items: [{ variantId: product.variants[0].id, quantity: 1 }],
      shippingAddress: {
        firstName: "Playwright",
        lastName: "Fulfillment",
        address1: "1 rue",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();

  for (const status of ["PENDING_PAYMENT", "PAID"]) {
    await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: authHeader(token),
      data: { status },
    });
  }

  await page.goto(`/orders/${order.id}`);

  await page.getByRole("button", { name: "Marquer en préparation" }).click();
  await expect(page.getByRole("button", { name: "Marquer prête à expédier" })).toBeVisible();

  await page.getByRole("button", { name: "Marquer prête à expédier" }).click();
  await expect(page.getByPlaceholder("Numéro de suivi")).toBeVisible();

  await page.getByPlaceholder("Numéro de suivi").fill("TRACK-PLAYWRIGHT-1");
  await page.getByRole("button", { name: "Créer l'expédition" }).click();

  await expect(page.getByText("TRACK-PLAYWRIGHT-1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme expédiée" })).toBeVisible();

  await page.getByRole("button", { name: "Marquer comme expédiée" }).click();
  await expect(page.getByRole("button", { name: "Marquer en transit" })).toBeVisible();
});
