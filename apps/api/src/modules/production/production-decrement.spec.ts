import { describe, expect, it } from "vitest";
import { assertCanDecrement, InvalidDecrementError } from "./production-decrement";

const ok = { status: "IN_PROGRESS", quantityProduced: 10, quantity: 1, physicalStock: 10 } as const;

describe("assertCanDecrement", () => {
  it("autorise de retirer une unité d'un lot en cours", () => {
    expect(() => assertCanDecrement(ok)).not.toThrow();
    expect(() => assertCanDecrement({ ...ok, status: "PARTIALLY_COMPLETED" })).not.toThrow();
  });

  it("refuse un lot planifié, terminé ou annulé", () => {
    for (const status of ["PLANNED", "COMPLETED", "CANCELLED"] as const) {
      expect(() => assertCanDecrement({ ...ok, status })).toThrow(InvalidDecrementError);
    }
  });

  it("refuse une quantité nulle, négative ou non entière", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() => assertCanDecrement({ ...ok, quantity })).toThrow(InvalidDecrementError);
    }
  });

  it("refuse de retirer plus que ce qui a été produit", () => {
    expect(() => assertCanDecrement({ ...ok, quantityProduced: 2, quantity: 3 })).toThrow(
      /seulement 2/,
    );
    expect(() => assertCanDecrement({ ...ok, quantityProduced: 0 })).toThrow(InvalidDecrementError);
  });

  it("accepte de retirer exactement ce qui a été produit", () => {
    expect(() =>
      assertCanDecrement({ ...ok, quantityProduced: 3, quantity: 3, physicalStock: 3 }),
    ).not.toThrow();
  });

  it("refuse si le stock physique passerait sous zéro", () => {
    expect(() => assertCanDecrement({ ...ok, physicalStock: 0 })).toThrow(/Stock physique/);
  });
});
