import { describe, expect, it } from "vitest";
import { assertValidShipmentTransition, InvalidShipmentTransitionError } from "./shipment-status";

describe("assertValidShipmentTransition", () => {
  it("autorise le chemin nominal complet", () => {
    const path: Array<Parameters<typeof assertValidShipmentTransition>> = [
      ["PENDING", "LABEL_CREATED"],
      ["LABEL_CREATED", "SHIPPED"],
      ["SHIPPED", "IN_TRANSIT"],
      ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
      ["OUT_FOR_DELIVERY", "DELIVERED"],
    ];
    for (const [from, to] of path) {
      expect(() => assertValidShipmentTransition(from, to)).not.toThrow();
    }
  });

  it("autorise un raccourci direct PENDING -> SHIPPED (pas d'étiquette générée)", () => {
    expect(() => assertValidShipmentTransition("PENDING", "SHIPPED")).not.toThrow();
  });

  it("autorise une exception à tout moment après expédition, avec reprise", () => {
    expect(() => assertValidShipmentTransition("IN_TRANSIT", "EXCEPTION")).not.toThrow();
    expect(() => assertValidShipmentTransition("EXCEPTION", "IN_TRANSIT")).not.toThrow();
    expect(() => assertValidShipmentTransition("EXCEPTION", "DELIVERED")).not.toThrow();
  });

  it("autorise un retour depuis n'importe quel statut en transit", () => {
    expect(() => assertValidShipmentTransition("SHIPPED", "RETURNED")).not.toThrow();
    expect(() => assertValidShipmentTransition("OUT_FOR_DELIVERY", "RETURNED")).not.toThrow();
  });

  it("refuse un saut d'étape en arrière", () => {
    expect(() => assertValidShipmentTransition("OUT_FOR_DELIVERY", "PENDING")).toThrow(
      InvalidShipmentTransitionError,
    );
  });

  it("refuse toute transition depuis un état terminal", () => {
    expect(() => assertValidShipmentTransition("DELIVERED", "IN_TRANSIT")).toThrow(
      InvalidShipmentTransitionError,
    );
    expect(() => assertValidShipmentTransition("RETURNED", "PENDING")).toThrow(
      InvalidShipmentTransitionError,
    );
  });
});
