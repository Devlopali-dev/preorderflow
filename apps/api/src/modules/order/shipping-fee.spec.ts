import { describe, expect, it } from "vitest";
import {
  computeShippingAmount,
  parcelWeightGrams,
  resolveCarrier,
  resolveShippingAmount,
  type ShippingConfig,
} from "./shipping-fee";
import { carriersFor, carrierRate, DEFAULT_TARIFFS } from "./shipping-tariffs";

const base: ShippingConfig = {
  flatRate: 4.9,
  freeThreshold: 50,
  packagingWeightGrams: 10,
  tariffs: DEFAULT_TARIFFS,
  tariffsSyncedAt: null,
};

describe("parcelWeightGrams", () => {
  it("ajoute l'emballage au poids des articles", () => {
    expect(parcelWeightGrams(4 * 5, base)).toBe(30);
  });
});

describe("carrierRate", () => {
  it("applique la tranche de poids La Poste (lettres)", () => {
    expect(carrierRate(DEFAULT_TARIFFS, "LA_POSTE_VERTE", 20)).toBe(1.52);
    expect(carrierRate(DEFAULT_TARIFFS, "LA_POSTE_VERTE", 21)).toBe(3.1);
    expect(carrierRate(DEFAULT_TARIFFS, "LA_POSTE_SUIVIE", 15)).toBe(2.02);
    expect(carrierRate(DEFAULT_TARIFFS, "LA_POSTE_SUIVIE", 2000)).toBe(11.64);
  });

  it("applique la tranche de poids Colissimo", () => {
    expect(carrierRate(DEFAULT_TARIFFS, "COLISSIMO_RETRAIT", 250)).toBe(4.79);
    expect(carrierRate(DEFAULT_TARIFFS, "COLISSIMO_DOMICILE", 251)).toBe(7.59);
    expect(carrierRate(DEFAULT_TARIFFS, "COLISSIMO_DOMICILE", 30000)).toBe(39.59);
  });

  it("applique la tranche de poids Mondial Relay", () => {
    expect(carrierRate(DEFAULT_TARIFFS, "MONDIAL_RELAY_POINT", 250)).toBe(4.15);
    expect(carrierRate(DEFAULT_TARIFFS, "MONDIAL_RELAY_POINT", 1001)).toBe(7.99);
    expect(carrierRate(DEFAULT_TARIFFS, "MONDIAL_RELAY_DOMICILE", 25000)).toBe(42.99);
  });

  it("renvoie null au-delà de la dernière tranche", () => {
    expect(carrierRate(DEFAULT_TARIFFS, "LA_POSTE_VERTE", 2001)).toBeNull();
    expect(carrierRate(DEFAULT_TARIFFS, "COLISSIMO_RETRAIT", 5001)).toBeNull();
    expect(carrierRate(DEFAULT_TARIFFS, "MONDIAL_RELAY_POINT", 25001)).toBeNull();
  });
});

describe("carriersFor", () => {
  it("propose les six transporteurs pour un petit envoi", () => {
    expect(carriersFor(DEFAULT_TARIFFS, 30)).toHaveLength(6);
  });

  it("garde les lettres jusqu'à 2 kg, sans limite de quantité", () => {
    expect(carriersFor(DEFAULT_TARIFFS, 2000)).toContain("LA_POSTE_VERTE");
    expect(carriersFor(DEFAULT_TARIFFS, 2001)).not.toContain("LA_POSTE_VERTE");
    expect(carriersFor(DEFAULT_TARIFFS, 2001)).not.toContain("LA_POSTE_SUIVIE");
  });

  it("retire Colissimo retrait au-delà de 5 kg avec le barème par défaut", () => {
    expect(carriersFor(DEFAULT_TARIFFS, 5001)).not.toContain("COLISSIMO_RETRAIT");
    expect(carriersFor(DEFAULT_TARIFFS, 5001)).toContain("COLISSIMO_DOMICILE");
  });

  it("ne propose rien au-delà de 30 kg", () => {
    expect(carriersFor(DEFAULT_TARIFFS, 30001)).toEqual([]);
  });

  it("suit un barème synchronisé", () => {
    const synced = { ...DEFAULT_TARIFFS, COLISSIMO_RETRAIT: [[30000, 9] as const] };
    expect(carriersFor(synced, 6000)).toContain("COLISSIMO_RETRAIT");
  });
});

describe("computeShippingAmount", () => {
  it("applique le forfait historique sans transporteur", () => {
    expect(computeShippingAmount(20, base)).toBe(4.9);
  });

  it("applique le tarif du transporteur selon le poids", () => {
    expect(computeShippingAmount(20, base, "LA_POSTE_SUIVIE", 25)).toBe(3.6);
    expect(computeShippingAmount(20, base, "MONDIAL_RELAY_POINT", 25)).toBe(4.15);
  });

  it("utilise le barème synchronisé de la configuration", () => {
    const config = {
      ...base,
      tariffs: { ...DEFAULT_TARIFFS, LA_POSTE_VERTE: [[2000, 1.3] as const] },
    };
    expect(computeShippingAmount(20, config, "LA_POSTE_VERTE", 25)).toBe(1.3);
  });

  it("offre la livraison dès que le seuil est atteint", () => {
    expect(computeShippingAmount(50, base, "LA_POSTE_VERTE", 30)).toBe(0);
    expect(computeShippingAmount(80, base, "MONDIAL_RELAY_DOMICILE", 30)).toBe(0);
  });

  it("n'offre jamais la livraison sans seuil", () => {
    expect(
      computeShippingAmount(1000, { ...base, freeThreshold: null }, "MONDIAL_RELAY_POINT", 30),
    ).toBe(4.15);
  });

  it("refuse un poids hors barème", () => {
    expect(() => computeShippingAmount(20, base, "LA_POSTE_VERTE", 2001)).toThrow();
  });
});

describe("resolveCarrier", () => {
  it("n'attribue aucun transporteur en main propre", () => {
    expect(resolveCarrier("PICKUP", 25, base, "LA_POSTE_VERTE")).toBeNull();
  });

  it("prend le premier transporteur disponible par défaut", () => {
    expect(resolveCarrier("SHIPPING", 25, base)).toBe("LA_POSTE_SUIVIE");
    expect(resolveCarrier("SHIPPING", 3000, base)).toBe("COLISSIMO_RETRAIT");
  });

  it("accepte un choix disponible", () => {
    expect(resolveCarrier("SHIPPING", 25, base, "COLISSIMO_DOMICILE")).toBe("COLISSIMO_DOMICILE");
  });

  it("refuse une lettre au-delà de 2 kg", () => {
    expect(() => resolveCarrier("SHIPPING", 2500, base, "LA_POSTE_VERTE")).toThrow();
  });

  it("refuse tout envoi au-delà de 30 kg", () => {
    expect(() => resolveCarrier("SHIPPING", 31000, base)).toThrow();
  });
});

describe("resolveShippingAmount", () => {
  it("applique le barème du transporteur pour une livraison", () => {
    expect(resolveShippingAmount("SHIPPING", 20, base, undefined, "COLISSIMO_DOMICILE", 100)).toBe(
      5.49,
    );
  });

  it("préfère un montant explicite pour une livraison", () => {
    expect(resolveShippingAmount("SHIPPING", 20, base, 7)).toBe(7);
  });

  it("est toujours gratuite en main propre", () => {
    expect(resolveShippingAmount("PICKUP", 20, base)).toBe(0);
    expect(resolveShippingAmount("PICKUP", 20, base, 7)).toBe(0);
  });
});
