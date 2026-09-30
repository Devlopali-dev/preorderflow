// Une seule connexion admin par lancement de la suite : l'API limite le login à
// 10 requêtes par minute et par IP (protection brute-force), et la suite s'en
// approchait dès que chaque worker se reconnectait. Le jeton est transmis aux
// workers par l'environnement (helpers.ts : getAdminToken).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
}
