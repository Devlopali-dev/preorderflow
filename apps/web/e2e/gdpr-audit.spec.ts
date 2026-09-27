import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

test("l'admin peut exporter et anonymiser un client, chaque action est journalisée", async ({
  page,
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "SIFFLET-001");

  // Commande = déclenche ORDER_CREATED dans l'audit log
  const orderRes = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: auth,
    data: {
      customerEmail: "playwright-gdpr@example.com",
      customerFirstName: "Playwright",
      customerLastName: "Gdpr",
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: {
        firstName: "Playwright",
        lastName: "Gdpr",
        address1: "1 rue",
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    },
  });
  const order = await orderRes.json();

  const customersRes = await request.get(`${apiUrl}/api/v1/customers`, { headers: auth });
  const customer = (await customersRes.json()).find(
    (c: { email: string }) => c.email === "playwright-gdpr@example.com",
  );

  await page.goto(`/customers/${customer.id}`);
  await expect(page.getByRole("heading", { name: "Playwright Gdpr" })).toBeVisible();

  // Export : affiche le JSON exporté
  await page.getByRole("button", { name: "Exporter les données (RGPD)" }).click();
  await expect(page.getByText(/"email": "playwright-gdpr@example.com"/)).toBeVisible();

  // Anonymisation : confirmation navigateur, puis rafraîchissement
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Anonymiser" }).click();
  await expect(page.getByRole("heading", { name: "Anonymisé Anonymisé" })).toBeVisible();

  // Le snapshot de la commande, lui, n'est jamais touché (obligation
  // comptable indépendante de l'identité du client, §24).
  const orderAfter = await (
    await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })
  ).json();
  expect(orderAfter.shippingAddress.firstName).toBe("Playwright");

  // Chaque action RGPD est dans le journal d'audit
  await page.goto("/audit-logs");
  await expect(page.getByText("CUSTOMER_DATA_EXPORTED").first()).toBeVisible();
  await expect(page.getByText("CUSTOMER_ANONYMIZED").first()).toBeVisible();
  await expect(page.getByText("ORDER_CREATED").first()).toBeVisible();
});

test("un opérateur (non-admin) ne peut pas exécuter les actions RGPD", async ({ request }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const loginRes = await request.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: "operateur1@preorderflow.dev", password: "password123" },
  });
  const { accessToken } = await loginRes.json();

  const customersRes = await request.get(`${apiUrl}/api/v1/customers`, {
    headers: authHeader(accessToken),
  });
  const anyCustomer = (await customersRes.json())[0];

  const res = await request.post(`${apiUrl}/api/v1/customers/${anyCustomer.id}/gdpr-export`, {
    headers: authHeader(accessToken),
  });
  expect(res.status()).toBe(403);
});
