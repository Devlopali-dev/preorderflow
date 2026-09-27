// Le MCP server n'accède jamais à la base directement (cf.
// docs/architecture.md §34) : il passe par l'API REST comme n'importe quel
// autre client, avec un compte admin dédié (variables d'env). La sécurité
// (autorisation, RBAC) reste entièrement gérée par l'API — jamais dupliquée
// ici.

const API_URL = process.env.PREORDERFLOW_API_URL ?? "http://localhost:3001";
const EMAIL = process.env.PREORDERFLOW_MCP_EMAIL;
const PASSWORD = process.env.PREORDERFLOW_MCP_PASSWORD;

let cachedToken: string | null = null;

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "PREORDERFLOW_MCP_EMAIL et PREORDERFLOW_MCP_PASSWORD doivent être définis (compte admin ou opérateur dédié au MCP).",
    );
  }
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Échec d'authentification MCP (${res.status})`);
  }
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

async function authFetch(path: string, retry = true): Promise<Response> {
  cachedToken ??= await login();

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${cachedToken}` },
  });

  if (res.status === 401 && retry) {
    // Token expiré : on ré-authentifie une fois avant d'abandonner.
    cachedToken = null;
    return authFetch(path, false);
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) {
    throw new Error(`Erreur API ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Certaines lectures (statistiques de campagne) sont publiques côté API —
// pas besoin de token, mais on garde une fonction dédiée pour la clarté.
export async function apiGetPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Erreur API ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}
