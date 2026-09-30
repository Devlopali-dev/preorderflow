// Calculées à la volée à partir des CampaignInterest — jamais stockées
// (cf. docs/architecture.md §3 / §7 du cahier des charges).
// `quantity` d'un intérêt = somme de ses lignes (une par couleur).

export interface InterestItemForStats {
  variantId: string;
  label: string;
  quantity: number;
}

export interface InterestForStats {
  quantity: number;
  createdAt: Date;
  items?: InterestItemForStats[];
}

export interface QuantityDistributionBucket {
  quantity: number | "5+";
  count: number;
}

export interface VariantStatistics {
  variantId: string;
  label: string;
  people: number;
  quantity: number;
}

export interface CampaignStatistics {
  totalInterests: number;
  totalQuantity: number;
  averageQuantity: number;
  distribution: QuantityDistributionBucket[];
  evolution: Array<{ date: string; count: number }>;
  byVariant: VariantStatistics[];
}

export function computeCampaignStatistics(interests: InterestForStats[]): CampaignStatistics {
  const totalInterests = interests.length;
  const totalQuantity = interests.reduce((sum, i) => sum + i.quantity, 0);
  const averageQuantity = totalInterests === 0 ? 0 : totalQuantity / totalInterests;

  const buckets = new Map<number | "5+", number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    ["5+", 0],
  ]);
  for (const interest of interests) {
    const key = interest.quantity >= 5 ? "5+" : interest.quantity;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const evolutionMap = new Map<string, number>();
  for (const interest of interests) {
    const day = interest.createdAt.toISOString().slice(0, 10);
    evolutionMap.set(day, (evolutionMap.get(day) ?? 0) + 1);
  }
  const evolution = [...evolutionMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Une personne compte une fois par couleur demandée (un intérêt ne porte
  // qu'une ligne par variante).
  const variantMap = new Map<string, VariantStatistics>();
  for (const interest of interests) {
    for (const item of interest.items ?? []) {
      const current = variantMap.get(item.variantId) ?? {
        variantId: item.variantId,
        label: item.label,
        people: 0,
        quantity: 0,
      };
      current.people += 1;
      current.quantity += item.quantity;
      variantMap.set(item.variantId, current);
    }
  }
  const byVariant = [...variantMap.values()].sort(
    (a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label),
  );

  return {
    totalInterests,
    totalQuantity,
    averageQuantity,
    distribution: [...buckets.entries()].map(([quantity, count]) => ({ quantity, count })),
    evolution,
    byVariant,
  };
}
