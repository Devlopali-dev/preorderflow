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
  adminTokenPromise ??= (async () => {
    const res = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: "admin@preorderflow.dev", password: "password123" },
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
