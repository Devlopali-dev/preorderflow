import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// En dev, sans RESEND_API_KEY, les emails sont journalisés en console par
// ConsoleEmailProvider (cf. apps/api/src/modules/notification/email-provider.ts).
// Sert de "boîte mail" de test pour extraire le lien magique sans mock.
//
// Sources du journal, par ordre de priorité — la première qui contient un
// lien est utilisée :
// 1. PREORDERFLOW_API_LOG_PATH : en CI le step qui démarre l'API redirige
//    vers api.log — un chemin en dur cassait la CI (ENOENT).
// 2. Logs du conteneur `api` (docker compose up) : toujours à jour, contrairement
//    à un fichier local oublié qui contiendrait de vieux liens expirés.
// 3. api-debug.log à la racine : API lancée à la main (pnpm dev) avec sa
//    sortie redirigée.
function apiLogSources(): Array<() => string> {
  const repoRoot = path.resolve(__dirname, "../../..");
  const sources: Array<() => string> = [];
  if (process.env.PREORDERFLOW_API_LOG_PATH) {
    const explicit = process.env.PREORDERFLOW_API_LOG_PATH;
    sources.push(() => readFileSync(explicit, "utf-8"));
  }
  sources.push(() =>
    execSync("docker compose logs --no-color --tail=500 api", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  const localLog = path.join(repoRoot, "api-debug.log");
  if (existsSync(localLog)) sources.push(() => readFileSync(localLog, "utf-8"));
  return sources;
}

function extractLatestMagicLinkToken(): string {
  for (const readLog of apiLogSources()) {
    try {
      const matches = [...readLog().matchAll(/token=([A-Za-z0-9._-]+)/g)];
      const last = matches.at(-1);
      if (last) return last[1];
    } catch {
      // Source indisponible (pas de Docker, fichier absent) : essayer la suivante.
    }
  }
  throw new Error(
    "Aucun lien magique trouvé dans les logs de l'API (PREORDERFLOW_API_LOG_PATH, conteneur Docker `api` ou api-debug.log)",
  );
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
