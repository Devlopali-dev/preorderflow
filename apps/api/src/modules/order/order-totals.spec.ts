import { describe, expect, it } from "vitest";
import { computeOrderTotals } from "./order-totals";

describe("computeOrderTotals", () => {
  it("calcule sous-total, taxe et total pour une ligne simple", () => {
    const result = computeOrderTotals([{ quantity: 3, unitPrice: 5, taxRate: 20 }], 3);
    expect(result.subtotal).toBe(15);
    expect(result.taxAmount).toBe(3);
    expect(result.total).toBe(21);
  });

  it("gère plusieurs lignes avec des taux de taxe différents", () => {
    const result = computeOrderTotals([
      { quantity: 2, unitPrice: 10, taxRate: 20 },
      { quantity: 1, unitPrice: 8, taxRate: 5.5 },
    ]);
    expect(result.subtotal).toBe(28);
    expect(result.taxAmount).toBeCloseTo(4.44, 2);
    expect(result.total).toBeCloseTo(32.44, 2);
  });

  it("gère une commande sans frais de port", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 5, taxRate: 0 }]);
    expect(result.total).toBe(5);
  });

  it("arrondit à 2 décimales sans dérive", () => {
    const result = computeOrderTotals([{ quantity: 3, unitPrice: 5.005, taxRate: 20 }]);
    expect(Number.isFinite(result.subtotal)).toBe(true);
    expect(result.subtotal.toString()).not.toMatch(/\.\d{3,}/);
  });

  it("panier vide donne des totaux nuls", () => {
    const result = computeOrderTotals([]);
    expect(result).toMatchObject({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});
