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
//
// `email` restreint aux liens envoyés à ce destinataire : plusieurs tests se
// connectent en parallèle, et un lien est à usage unique — prendre « le dernier
// lien » du journal pouvait récupérer celui d'un autre test.
export function readMagicLinkTokens(email?: string): string[] {
  for (const readLog of apiLogSources()) {
    try {
      // Un message journalisé commence par « [email:console] to=<destinataire> ».
      const blocks = readLog().split("[email:console]").slice(1);
      const wanted = email
        ? blocks.filter((block) => block.trimStart().startsWith(`to=${email} `))
        : blocks;
      const tokens = wanted.flatMap((block) =>
        [...block.matchAll(/token=([A-Za-z0-9._-]+)/g)].map((m) => m[1]!),
      );
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
export async function waitForNewMagicLinkToken(
  known: Set<string>,
  email?: string,
): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const fresh = readMagicLinkTokens(email).filter((token) => !known.has(token));
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
  const knownTokens = new Set(readMagicLinkTokens(email));
  await page.goto("/mon-compte/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText(/Vérifiez vos emails/)).toBeVisible();
  const token = await waitForNewMagicLinkToken(knownTokens, email);
  await page.goto(`/mon-compte/verifier?token=${token}`);
  await expect(page).toHaveURL(/\/mon-compte$/);
}

// Tous les e-mails journalisés par le fournisseur « console » (un bloc par message :
// `to=<destinataire> subject="…"` puis le HTML), depuis la première source de journal disponible.
export function readConsoleEmails(): string[] {
  for (const readLog of apiLogSources()) {
    try {
      const blocks = readLog().split("[email:console]").slice(1);
      if (blocks.length > 0) return blocks;
    } catch {
      // Source indisponible : essayer la suivante.
    }
  }
  return [];
}

// Attend un e-mail adressé à `to` dont le sujet contient `subjectPart`, et le renvoie.
export async function waitForEmail(
  to: string,
  subjectPart: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = readConsoleEmails().find(
      (block) => block.trimStart().startsWith(`to=${to} `) && block.includes(subjectPart),
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Aucun e-mail « ${subjectPart} » pour ${to} dans les logs de l'API`);
}

// Vrai si un e-mail adressé à `to` (sujet contenant `subjectPart`) figure dans les logs.
export function hasEmail(to: string, subjectPart: string): boolean {
  return readConsoleEmails().some(
    (block) => block.trimStart().startsWith(`to=${to} `) && block.includes(subjectPart),
  );
}
