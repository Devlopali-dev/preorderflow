import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// En dev, sans RESEND_API_KEY, les emails sont journalisés en console par
// ConsoleEmailProvider (cf. apps/api/src/modules/notification/email-provider.ts).
// Sert de "boîte mail" de test pour extraire le lien magique sans mock.
// Chemin configurable (PREORDERFLOW_API_LOG_PATH) : en local le fichier
// s'appelle souvent api-debug.log, en CI le step qui démarre l'API redirige
// vers api.log — un chemin en dur cassait la CI (ENOENT) alors que le test
// passait toujours en local.
function extractLatestMagicLinkToken(): string {
  const logPath =
    process.env.PREORDERFLOW_API_LOG_PATH ?? path.resolve(__dirname, "../../../api-debug.log");
  const log = readFileSync(logPath, "utf-8");
  const matches = [...log.matchAll(/token=([A-Za-z0-9._-]+)/g)];
  const last = matches.at(-1);
  if (!last) throw new Error("Aucun lien magique trouvé dans les logs de l'API");
  return last[1];
}

test("un client peut se connecter par magic link et voir ses commandes, isolées des autres clients", async ({
  page,
  request,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // 1. Demande de lien
  await page.goto("/mon-compte/connexion");
  await page.getByLabel("Email").fill("client3@example.com");
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText(/Vérifiez vos emails/)).toBeVisible();

  // 2. Récupération du token (boîte mail de test) et vérification
  const token = extractLatestMagicLinkToken();
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
