import { describe, expect, it } from "vitest";
import { computeStockSnapshot, sumStockSnapshots } from "./inventory-stock";

// Le stock est calculé par variante (couleur) ; le total d'un produit est la
// somme de ses variantes, jamais une valeur stockée.
describe("sumStockSnapshots", () => {
  it("somme le physique, le réservé et le disponible de toutes les variantes", () => {
    const rouge = computeStockSnapshot([40], [10]);
    const bleu = computeStockSnapshot([30, -2], [5]);
    const noir = computeStockSnapshot([30], []);

    expect(sumStockSnapshots([rouge, bleu, noir])).toEqual({
      physicalStock: 98,
      reservedStock: 15,
      availableStock: 83,
    });
  });

  it("une couleur en rupture ne masque pas le stock des autres", () => {
    const rouge = computeStockSnapshot([10], [12]);
    const bleu = computeStockSnapshot([50], [5]);

    expect(rouge.availableStock).toBe(-2);
    expect(bleu.availableStock).toBe(45);
    expect(sumStockSnapshots([rouge, bleu]).availableStock).toBe(43);
  });

  it("un produit sans variante donne un stock nul", () => {
    expect(sumStockSnapshots([])).toEqual({
      physicalStock: 0,
      reservedStock: 0,
      availableStock: 0,
    });
  });
});
