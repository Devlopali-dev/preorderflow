import { expect, type Page } from "@playwright/test";
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

// Tous les liens magiques journalisés, dans l'ordre, depuis la première source
// disponible qui en contient.
export function readMagicLinkTokens(): string[] {
  for (const readLog of apiLogSources()) {
    try {
      const tokens = [...readLog().matchAll(/token=([A-Za-z0-9._-]+)/g)].map((m) => m[1]);
      if (tokens.length > 0) return tokens;
    } catch {
      // Source indisponible (pas de Docker, fichier absent) : essayer la suivante.
    }
  }
  return [];
}

// Le log s'écrit après la réponse de l'API (et `docker compose logs` a un léger
// retard) : lire « le dernier lien » tout de suite risquait de prendre un
// ancien lien déjà consommé. On attend qu'un lien absent de `known` apparaisse.
export async function waitForNewMagicLinkToken(known: Set<string>): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const fresh = readMagicLinkTokens().filter((token) => !known.has(token));
    if (fresh.length > 0) return fresh[fresh.length - 1]!;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "Aucun nouveau lien magique dans les logs de l'API (PREORDERFLOW_API_LOG_PATH, conteneur Docker `api` ou api-debug.log)",
  );
}

// Connexion d'un client du seed par lien magique : lit le lien dans la « boîte
// mail » de test (logs de l'API, fournisseur e-mail « console »).
export async function loginAsCustomer(page: Page, email: string): Promise<void> {
  const knownTokens = new Set(readMagicLinkTokens());
  await page.goto("/mon-compte/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText(/Vérifiez vos emails/)).toBeVisible();
  const token = await waitForNewMagicLinkToken(knownTokens);
  await page.goto(`/mon-compte/verifier?token=${token}`);
  await expect(page).toHaveURL(/\/mon-compte$/);
}
