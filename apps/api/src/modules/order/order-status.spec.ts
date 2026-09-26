import { describe, expect, it } from "vitest";
import { assertValidOrderTransition, InvalidOrderTransitionError } from "./order-status";

describe("assertValidOrderTransition", () => {
  it("autorise le chemin nominal complet", () => {
    const path: Array<Parameters<typeof assertValidOrderTransition>> = [
      ["DRAFT", "PENDING_PAYMENT"],
      ["PENDING_PAYMENT", "PAID"],
      ["PAID", "PROCESSING"],
      ["PROCESSING", "READY_TO_SHIP"],
      ["READY_TO_SHIP", "SHIPPED"],
      ["SHIPPED", "DELIVERED"],
    ];
    for (const [from, to] of path) {
      expect(() => assertValidOrderTransition(from, to)).not.toThrow();
    }
  });

  it("autorise l'annulation avant paiement complet", () => {
    expect(() => assertValidOrderTransition("DRAFT", "CANCELLED")).not.toThrow();
    expect(() => assertValidOrderTransition("PENDING_PAYMENT", "CANCELLED")).not.toThrow();
    expect(() => assertValidOrderTransition("PAID", "CANCELLED")).not.toThrow();
  });

  it("refuse l'annulation après le début de préparation", () => {
    expect(() => assertValidOrderTransition("PROCESSING", "CANCELLED")).toThrow(
      InvalidOrderTransitionError,
    );
  });

  it("autorise le remboursement depuis n'importe quel statut payé", () => {
    for (const from of ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] as const) {
      expect(() => assertValidOrderTransition(from, "REFUNDED")).not.toThrow();
    }
  });

  it("refuse un saut d'étape", () => {
    expect(() => assertValidOrderTransition("PENDING_PAYMENT", "SHIPPED")).toThrow(
      InvalidOrderTransitionError,
    );
  });

  it("refuse toute transition depuis un état terminal", () => {
    expect(() => assertValidOrderTransition("CANCELLED", "PAID")).toThrow(
      InvalidOrderTransitionError,
    );
    expect(() => assertValidOrderTransition("REFUNDED", "PAID")).toThrow(
      InvalidOrderTransitionError,
    );
  });
});
