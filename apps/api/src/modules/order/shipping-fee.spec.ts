import { describe, expect, it } from "vitest";
import { computeShippingAmount } from "./shipping-fee";

describe("computeShippingAmount", () => {
  it("applique le forfait sous le seuil", () => {
    expect(computeShippingAmount(20, { flatRate: 4.9, freeThreshold: 50 })).toBe(4.9);
  });

  it("offre la livraison dès que le seuil est atteint", () => {
    expect(computeShippingAmount(50, { flatRate: 4.9, freeThreshold: 50 })).toBe(0);
    expect(computeShippingAmount(80, { flatRate: 4.9, freeThreshold: 50 })).toBe(0);
  });

  it("n'offre jamais la livraison sans seuil", () => {
    expect(computeShippingAmount(1000, { flatRate: 4.9, freeThreshold: null })).toBe(4.9);
  });

  it("vaut 0 quand aucun forfait n'est configuré", () => {
    expect(computeShippingAmount(10, { flatRate: 0, freeThreshold: null })).toBe(0);
  });
});
