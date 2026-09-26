import { describe, expect, it } from "vitest";
import { computeCampaignStatistics } from "./campaign-statistics";

function interest(quantity: number, isoDate: string) {
  return { quantity, createdAt: new Date(isoDate) };
}

describe("computeCampaignStatistics", () => {
  it("gère le cas vide", () => {
    const stats = computeCampaignStatistics([]);
    expect(stats.totalInterests).toBe(0);
    expect(stats.totalQuantity).toBe(0);
    expect(stats.averageQuantity).toBe(0);
    expect(stats.evolution).toEqual([]);
  });

  it("reproduit l'exemple métier du cahier des charges (§7)", () => {
    const interests = [
      ...Array(96).fill(1),
      ...Array(54).fill(2),
      ...Array(21).fill(3),
      ...Array(8).fill(4),
      ...Array(3).fill(5),
      ...Array(2).fill(7),
    ].map((q) => interest(q, "2026-01-01T10:00:00.000Z"));

    const stats = computeCampaignStatistics(interests);

    expect(stats.totalInterests).toBe(184);
    expect(stats.totalQuantity).toBe(96 * 1 + 54 * 2 + 21 * 3 + 8 * 4 + 3 * 5 + 2 * 7);

    const bucket5plus = stats.distribution.find((b) => b.quantity === "5+");
    expect(bucket5plus?.count).toBe(5);
    expect(stats.distribution.find((b) => b.quantity === 1)?.count).toBe(96);
    expect(stats.distribution.find((b) => b.quantity === 2)?.count).toBe(54);
    expect(stats.distribution.find((b) => b.quantity === 3)?.count).toBe(21);
    expect(stats.distribution.find((b) => b.quantity === 4)?.count).toBe(8);
  });

  it("calcule la moyenne correctement", () => {
    const stats = computeCampaignStatistics([
      interest(1, "2026-01-01T00:00:00.000Z"),
      interest(3, "2026-01-01T00:00:00.000Z"),
    ]);
    expect(stats.averageQuantity).toBe(2);
  });

  it("regroupe l'évolution par jour, triée chronologiquement", () => {
    const stats = computeCampaignStatistics([
      interest(1, "2026-01-02T08:00:00.000Z"),
      interest(1, "2026-01-01T23:59:00.000Z"),
      interest(1, "2026-01-01T00:00:00.000Z"),
    ]);
    expect(stats.evolution).toEqual([
      { date: "2026-01-01", count: 2 },
      { date: "2026-01-02", count: 1 },
    ]);
  });
});
