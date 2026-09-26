// URL de l'API côté serveur (réseau interne) — côté client, utiliser
// NEXT_PUBLIC_API_URL directement dans les composants "use client".
export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  indicativePrice: string;
  currency: string;
  imageUrl: string | null;
}

export async function getCampaign(slug: string): Promise<Campaign | null> {
  const res = await fetch(`${API_URL}/api/v1/campaigns/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}
