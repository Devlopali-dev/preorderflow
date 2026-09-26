import { describe, expect, it } from "vitest";
import { computeStockSnapshot } from "./inventory-stock";

describe("computeStockSnapshot", () => {
  it("reproduit l'exemple métier du cahier des charges (§14)", () => {
    // 350 fabriqués, aucune vente comptée en mouvement de sortie ; les 301
    // commandes sont la réservation, jamais confondue avec le stock physique.
    const snapshot = computeStockSnapshot([350], [301]);
    expect(snapshot.physicalStock).toBe(350);
    expect(snapshot.reservedStock).toBe(301);
    expect(snapshot.availableStock).toBe(49);
  });

  it("gère plusieurs mouvements (production + ajustements + dommages)", () => {
    const snapshot = computeStockSnapshot([350, 10, -5], [301]);
    expect(snapshot.physicalStock).toBe(355);
    expect(snapshot.availableStock).toBe(54);
  });

  it("aucun mouvement ni réservation donne un stock nul", () => {
    expect(computeStockSnapshot([], [])).toEqual({
      physicalStock: 0,
      reservedStock: 0,
      availableStock: 0,
    });
  });

  it("le stock disponible peut être négatif (survente à corriger manuellement)", () => {
    const snapshot = computeStockSnapshot([100], [120]);
    expect(snapshot.availableStock).toBe(-20);
  });
});
