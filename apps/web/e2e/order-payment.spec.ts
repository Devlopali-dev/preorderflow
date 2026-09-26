import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

test("le détail d'une commande permet de générer un paiement Revolut (QR + lien)", async ({
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
      customerEmail: "playwright-payment@example.com",
      customerFirstName: "Playwright",
      customerLastName: "Test",
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: {
        firstName: "Playwright",
        lastName: "Test",
        address1: "1 rue",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: `Commande #${order.number}` })).toBeVisible();

  await page.getByRole("button", { name: "Générer le paiement (Revolut)" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme payée" })).toBeVisible();
  await expect(page.getByAltText("QR code de paiement Revolut")).toBeVisible();

  await page.getByRole("button", { name: "Marquer comme payée" }).click();
  await expect(page.getByText(/Paiement reçu/)).toBeVisible();
});
