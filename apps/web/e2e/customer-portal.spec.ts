import { test, expect } from "@playwright/test";
import { readMagicLinkTokens, waitForNewMagicLinkToken } from "./magic-link";

test("un client peut se connecter par magic link et voir ses commandes, isolées des autres clients", async ({
  page,
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // 1. Demande de lien (on note les liens déjà journalisés pour reconnaître le nouveau)
  const knownTokens = new Set(readMagicLinkTokens());
  await page.goto("/mon-compte/connexion");
  await page.getByLabel("Email").fill("client3@example.com");
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText(/Vérifiez vos emails/)).toBeVisible();

  // 2. Récupération du token (boîte mail de test) et vérification
  const token = await waitForNewMagicLinkToken(knownTokens);
  await page.goto(`/mon-compte/verifier?token=${token}`);
  await expect(page).toHaveURL(/\/mon-compte$/);
  await expect(page.getByRole("heading", { name: "Mes commandes" })).toBeVisible();

  // 3. Isolation : la commande d'un autre client renvoie 404
  const otherOrders = await (
    await request.get(`${apiUrl}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${await getAdminToken(request, apiUrl)}` },
    })
  ).json();
  const otherCustomer = otherOrders.find(
    (c: { email: string }) => c.email === "client1@example.com",
  );
  const otherCustomerOrders = await (
    await request.get(`${apiUrl}/api/v1/customers/${otherCustomer.id}`, {
      headers: { Authorization: `Bearer ${await getAdminToken(request, apiUrl)}` },
    })
  ).json();
  const otherOrderId = otherCustomerOrders.orders[0]?.id;
  if (otherOrderId) {
    const res = await page.goto(`/mon-compte/commandes/${otherOrderId}`);
    expect(res?.status()).toBe(404);
  }

  // 4. Déconnexion révoque l'accès
  await page.goto("/mon-compte");
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/mon-compte\/connexion/);
  await page.goto("/mon-compte");
  await expect(page).toHaveURL(/\/mon-compte\/connexion/);
});

async function getAdminToken(
  request: import("@playwright/test").APIRequestContext,
  apiUrl: string,
) {
  const res = await request.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: "admin@preorderflow.dev", password: "password123" },
  });
  return (await res.json()).accessToken;
}
