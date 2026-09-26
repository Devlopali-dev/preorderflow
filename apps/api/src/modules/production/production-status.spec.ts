import { describe, expect, it } from "vitest";
import {
  assertValidProductionTransition,
  computeCompletionStatus,
  InvalidProductionTransitionError,
} from "./production-status";

describe("assertValidProductionTransition", () => {
  it("autorise le chemin nominal", () => {
    expect(() => assertValidProductionTransition("PLANNED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertValidProductionTransition("IN_PROGRESS", "COMPLETED")).not.toThrow();
  });

  it("autorise l'annulation avant complétion", () => {
    expect(() => assertValidProductionTransition("PLANNED", "CANCELLED")).not.toThrow();
    expect(() => assertValidProductionTransition("IN_PROGRESS", "CANCELLED")).not.toThrow();
  });

  it("autorise le passage de partiellement complété à complété (complément ultérieur)", () => {
    expect(() => assertValidProductionTransition("PARTIALLY_COMPLETED", "COMPLETED")).not.toThrow();
  });

  it("refuse toute transition depuis un état terminal", () => {
    expect(() => assertValidProductionTransition("COMPLETED", "IN_PROGRESS")).toThrow(
      InvalidProductionTransitionError,
    );
    expect(() => assertValidProductionTransition("CANCELLED", "PLANNED")).toThrow(
      InvalidProductionTransitionError,
    );
  });

  it("refuse d'annuler une production déjà partiellement complétée", () => {
    expect(() => assertValidProductionTransition("PARTIALLY_COMPLETED", "CANCELLED")).toThrow(
      InvalidProductionTransitionError,
    );
  });
});

describe("computeCompletionStatus", () => {
  it("retourne COMPLETED si toutes les lignes atteignent leur quantité prévue", () => {
    const status = computeCompletionStatus([
      { quantityPlanned: 100, quantityProduced: 100 },
      { quantityPlanned: 50, quantityProduced: 55 },
    ]);
    expect(status).toBe("COMPLETED");
  });

  it("retourne PARTIALLY_COMPLETED si une ligne est en dessous du prévu", () => {
    const status = computeCompletionStatus([
      { quantityPlanned: 100, quantityProduced: 80 },
      { quantityPlanned: 50, quantityProduced: 50 },
    ]);
    expect(status).toBe("PARTIALLY_COMPLETED");
  });

  it("retourne PARTIALLY_COMPLETED si rien n'a été produit", () => {
    expect(computeCompletionStatus([{ quantityPlanned: 100, quantityProduced: 0 }])).toBe(
      "PARTIALLY_COMPLETED",
    );
  });
});
