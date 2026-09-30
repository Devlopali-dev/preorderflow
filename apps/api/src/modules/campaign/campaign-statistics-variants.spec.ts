import { describe, expect, it } from "vitest";
import { computeCampaignStatistics } from "./campaign-statistics";

const ROUGE = { variantId: "v-rouge", label: "Rouge" };
const BLEU = { variantId: "v-bleu", label: "Bleu" };

function interest(
  items: Array<{ variantId: string; label: string; quantity: number }>,
  isoDate: string,
) {
  return {
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: new Date(isoDate),
    items,
  };
}

describe("computeCampaignStatistics — ventilation par couleur", () => {
  it("compte une personne par couleur demandée et somme les quantités", () => {
    const stats = computeCampaignStatistics([
      interest(
        [
          { ...ROUGE, quantity: 2 },
          { ...BLEU, quantity: 1 },
        ],
        "2026-01-01T10:00:00.000Z",
      ),
      interest([{ ...ROUGE, quantity: 3 }], "2026-01-02T10:00:00.000Z"),
    ]);

    expect(stats.byVariant).toEqual([
      { variantId: "v-rouge", label: "Rouge", people: 2, quantity: 5 },
      { variantId: "v-bleu", label: "Bleu", people: 1, quantity: 1 },
    ]);
  });

  it("la personne reste comptée une seule fois dans le total, même avec plusieurs couleurs", () => {
    const stats = computeCampaignStatistics([
      interest(
        [
          { ...ROUGE, quantity: 2 },
          { ...BLEU, quantity: 2 },
        ],
        "2026-01-01T10:00:00.000Z",
      ),
    ]);

    expect(stats.totalInterests).toBe(1);
    expect(stats.totalQuantity).toBe(4);
    // La distribution porte sur la quantité totale de la personne (2 + 2 = 4).
    expect(stats.distribution.find((b) => b.quantity === 4)?.count).toBe(1);
  });

  it("trie les couleurs par quantité décroissante puis par nom", () => {
    const stats = computeCampaignStatistics([
      interest([{ ...BLEU, quantity: 1 }], "2026-01-01T10:00:00.000Z"),
      interest([{ ...ROUGE, quantity: 1 }], "2026-01-01T11:00:00.000Z"),
    ]);

    expect(stats.byVariant.map((v) => v.label)).toEqual(["Bleu", "Rouge"]);
  });

  it("renvoie une ventilation vide quand les intérêts n'ont pas de lignes", () => {
    const stats = computeCampaignStatistics([
      { quantity: 2, createdAt: new Date("2026-01-01T10:00:00.000Z") },
    ]);
    expect(stats.byVariant).toEqual([]);
  });
});
