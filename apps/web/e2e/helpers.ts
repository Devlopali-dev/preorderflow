import type { APIRequestContext, Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Toutes les routes API (hors lecture publique campagnes/produits) exigent
// un Bearer token depuis la phase auth — nécessaire pour tout appel direct
// à l'API NestJS depuis un test (setup de données), en plus du cookie posé
// pour la navigation dans les pages admin.
export async function getAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: "admin@preorderflow.dev", password: "password123" },
  });
  const { accessToken } = await res.json();
  return accessToken;
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
