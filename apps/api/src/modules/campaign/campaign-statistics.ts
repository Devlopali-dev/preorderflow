// Calculées à la volée à partir des CampaignInterest — jamais stockées
// (cf. docs/architecture.md §3 / §7 du cahier des charges).

export interface InterestForStats {
  quantity: number;
  createdAt: Date;
}

export interface QuantityDistributionBucket {
  quantity: number | "5+";
  count: number;
}

export interface CampaignStatistics {
  totalInterests: number;
  totalQuantity: number;
  averageQuantity: number;
  distribution: QuantityDistributionBucket[];
  evolution: Array<{ date: string; count: number }>;
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

  return {
    totalInterests,
    totalQuantity,
    averageQuantity,
    distribution: [...buckets.entries()].map(([quantity, count]) => ({ quantity, count })),
    evolution,
  };
}
