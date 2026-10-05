import { LA_POSTE_CARRIER_CODES, type CarrierCode, type Tier } from "./shipping-tariffs";

// Jeu de données « Tarifs postaux Entreprises et Collectivités 2026 » (Licence Ouverte 2.0),
// plateforme Data Fair, sans clé d'API.
const LINES_URL =
  "https://data.laposte.fr/data-fair/api/v1/datasets/tarifs-postaux-entreprises-et-collectivites-2026/lines";

// Colissimo est facturé HT dans l'API ; le client paie TTC.
const COLISSIMO_VAT = 1.2;

export interface LaPosteLine {
  produit?: string | null;
  type_denvoi?: string | null;
  poids_max_en_g_avec_supplement?: number | null;
  tarifs_nets_unitaires_en_euro?: number | null;
  tarif_ht_en_euro?: number | null;
}

type LaPosteCarrierCode = (typeof LA_POSTE_CARRIER_CODES)[number];

// Pour chaque transporteur : produit exact du jeu de données, type d'envoi retenu (les autres
// lignes sont des envois en nombre, des lots, des options…), colonne de prix et coefficient.
const SOURCES: Record<
  LaPosteCarrierCode,
  { produit: string; typeDenvoi: string; price: "net" | "ht"; coefficient: number }
> = {
  LA_POSTE_VERTE: {
    produit: "Lettre Verte",
    typeDenvoi: "Envois du quotidien",
    price: "net",
    coefficient: 1,
  },
  LA_POSTE_SUIVIE: {
    produit: "Lettre verte suivie",
    typeDenvoi: "Envois suivis",
    price: "net",
    coefficient: 1,
  },
  COLISSIMO_RETRAIT: {
    produit: "Colissimo Point Retrait",
    typeDenvoi: "Colis en France Metropolitaine",
    price: "ht",
    coefficient: COLISSIMO_VAT,
  },
  COLISSIMO_DOMICILE: {
    produit: "Colissimo Domicile",
    typeDenvoi: "Colis en France Metropolitaine",
    price: "ht",
    coefficient: COLISSIMO_VAT,
  },
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// Transforme les lignes du jeu de données en tranches [poids max, prix] pour un transporteur.
// Les lignes sans poids max ou sans prix (suppléments, options) sont ignorées.
export function parseCarrierTiers(carrier: LaPosteCarrierCode, lines: LaPosteLine[]): Tier[] {
  const source = SOURCES[carrier];
  const byWeight = new Map<number, number>();
  for (const line of lines) {
    if (line.produit !== source.produit) continue;
    if (!line.type_denvoi?.startsWith(source.typeDenvoi)) continue;
    const maxGrams = line.poids_max_en_g_avec_supplement;
    const price =
      source.price === "net" ? line.tarifs_nets_unitaires_en_euro : line.tarif_ht_en_euro;
    if (typeof maxGrams !== "number" || typeof price !== "number") continue;
    byWeight.set(maxGrams, round2(price * source.coefficient));
  }
  return [...byWeight.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([grams, price]) => [grams, price]);
}

// Refuse un barème incohérent : mieux vaut garder l'ancien que facturer de travers.
export function assertPlausibleTiers(carrier: CarrierCode, tiers: ReadonlyArray<Tier>): void {
  if (tiers.length < 3) {
    throw new Error(`Barème ${carrier} incomplet (${tiers.length} tranche(s))`);
  }
  let previousPrice = 0;
  for (const [maxGrams, price] of tiers) {
    if (!(maxGrams > 0) || !(price > 0)) {
      throw new Error(`Barème ${carrier} invalide (${maxGrams} g → ${price} €)`);
    }
    if (price < previousPrice) {
      throw new Error(`Barème ${carrier} non croissant à ${maxGrams} g`);
    }
    previousPrice = price;
  }
}

export type LaPosteTariffs = Record<LaPosteCarrierCode, Tier[]>;

async function fetchLines(produit: string): Promise<LaPosteLine[]> {
  const params = new URLSearchParams({
    size: "200",
    qs: `produit:"${produit}"`,
    select:
      "produit,type_denvoi,poids_max_en_g_avec_supplement,tarifs_nets_unitaires_en_euro,tarif_ht_en_euro",
  });
  const res = await fetch(`${LINES_URL}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`API La Poste : HTTP ${res.status} pour « ${produit} »`);
  const body = (await res.json()) as { results?: LaPosteLine[] };
  return body.results ?? [];
}

// Interroge l'API La Poste et renvoie le barème des quatre transporteurs, ou lève une erreur si
// l'un d'eux est incohérent (rien n'est alors écrasé par l'appelant).
export async function fetchLaPosteTariffs(): Promise<LaPosteTariffs> {
  const entries = await Promise.all(
    LA_POSTE_CARRIER_CODES.map(async (carrier) => {
      const tiers = parseCarrierTiers(carrier, await fetchLines(SOURCES[carrier].produit));
      assertPlausibleTiers(carrier, tiers);
      return [carrier, tiers] as const;
    }),
  );
  return Object.fromEntries(entries) as LaPosteTariffs;
}
