// Préparation de la suite E2E, une fois par lancement.
//
// 1. Une seule connexion admin : l'API limite le login à 10 requêtes par minute
//    et par IP (protection brute-force), et la suite s'en approchait dès que
//    chaque worker se reconnectait. Le jeton est transmis aux workers par
//    l'environnement (helpers.ts : getAdminToken).
// 2. Préchauffage des pages : en mode dev, Next compile chaque page à sa
//    première visite. Sans ça, la première exécution après une modification est
//    lente et des clics arrivent avant l'hydratation (test flaky). On visite
//    donc les pages une fois, en séquence, avant que les tests ne démarrent.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

const ADMIN_PAGES = [
  "/dashboard",
  "/campaigns",
  "/orders",
  "/customers",
  "/inventory",
  "/production",
  "/shipments",
  "/settings",
];
const PUBLIC_PAGES = ["/", "/login", "/mon-compte/connexion"];

async function warmUp(path: string, headers: Record<string, string>): Promise<void> {
  try {
    await fetch(`${WEB_URL}${path}`, { headers, redirect: "manual" });
  } catch {
    // Préchauffage au mieux : une page indisponible sera signalée par ses tests.
  }
}

export default async function globalSetup(): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@preorderflow.dev", password: "password123" }),
  });
  if (!res.ok) {
    throw new Error(`Connexion admin impossible pour les tests E2E (${res.status})`);
  }
  const { accessToken } = await res.json();
  process.env.E2E_ADMIN_TOKEN = accessToken;

  for (const path of PUBLIC_PAGES) await warmUp(path, {});
  for (const path of ADMIN_PAGES) await warmUp(path, { Cookie: `poflow_token=${accessToken}` });
}
