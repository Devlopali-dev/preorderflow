import type { APIRequestContext, Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Toutes les routes API (hors lecture publique campagnes/produits) exigent
// un Bearer token depuis la phase auth — nécessaire pour tout appel direct
// à l'API NestJS depuis un test (setup de données), en plus du cookie posé
// pour la navigation dans les pages admin.
//
// Un seul jeton par worker Playwright : l'API limite le login à 10 requêtes par
// minute et par IP (protection brute-force) et chaque spec se reconnectait, ce
// qui faisait échouer la suite dès qu'elle dépassait ce seuil. Le module reste
// chargé pendant toute la vie d'un worker, donc le jeton est réutilisé par
// tous ses tests. Le login lui-même est testé dans auth.spec.ts (via l'UI).
let adminTokenPromise: Promise<string> | undefined;

export function getAdminToken(request: APIRequestContext): Promise<string> {
  // Jeton posé par global-setup.ts (une seule connexion pour toute la suite).
  if (process.env.E2E_ADMIN_TOKEN) return Promise.resolve(process.env.E2E_ADMIN_TOKEN);

  adminTokenPromise ??= (async () => {
    const res = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {
        email: process.env.E2E_ADMIN_EMAIL ?? "admin@preorderflow.dev",
        password: process.env.E2E_ADMIN_PASSWORD ?? "password123",
      },
    });
    if (!res.ok()) {
      throw new Error(`Connexion admin impossible (${res.status()})`);
    }
    const { accessToken } = await res.json();
    return accessToken as string;
  })().catch((error) => {
    // Ne pas garder un échec en cache : le test suivant doit pouvoir réessayer.
    adminTokenPromise = undefined;
    throw error;
  });
  return adminTokenPromise;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// Connecte une page en tant qu'admin en posant directement le cookie de
// session (récupéré via l'API) — plus rapide que de passer par le
// formulaire de login sur chaque test qui a besoin d'un accès admin.
// Le formulaire de login lui-même est testé séparément (auth.spec.ts).
export async function loginAsAdmin(page: Page, request: APIRequestContext): Promise<string> {
  const accessToken = await getAdminToken(request);

  await page.context().addCookies([
    {
      name: "poflow_token",
      value: accessToken,
      url: "http://localhost:3000",
    },
  ]);

  return accessToken;
}

// Paie réellement une commande : génère le paiement puis le confirme, ce qui
// renseigne aussi `paymentStatus`. Passer le statut à « payée » à la main laisse
// la commande non payée (donc non livrable).
export async function payOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<void> {
  const auth = authHeader(token);
  const created = await request.post(`${API_URL}/api/v1/orders/${orderId}/payments`, {
    headers: auth,
    data: { provider: "BANK_TRANSFER" },
  });
  if (!created.ok()) throw new Error(`Paiement impossible (${created.status()})`);
  const payment = await created.json();
  const confirmed = await request.post(`${API_URL}/api/v1/payments/${payment.id}/confirm`, {
    headers: auth,
  });
  if (!confirmed.ok()) throw new Error(`Confirmation impossible (${confirmed.status()})`);
}

// Couleurs créées puis supprimées par des tests qui tournent en parallèle
// (palette, couleur inactive ou « d'office ») : les autres tests ne doivent pas
// les choisir, elles peuvent disparaître en cours de route.
const TEMPORARY_COLORS = /^(Auto|Inactive)-\d+/;
export const VOLATILE_COLORS = ["Turquoise", "Bordeaux"];

export function isStableColor(color: { active: boolean; name: string }): boolean {
  return (
    color.active && !VOLATILE_COLORS.includes(color.name) && !TEMPORARY_COLORS.test(color.name)
  );
}
