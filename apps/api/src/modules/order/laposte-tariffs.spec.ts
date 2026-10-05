import { describe, expect, it } from "vitest";
import { assertPlausibleTiers, parseCarrierTiers, type LaPosteLine } from "./laposte-tariffs";

// Extraits réels du jeu de données data.laposte.fr « Tarifs postaux Entreprises et Collectivités 2026 ».
const lettreVerte: LaPosteLine[] = [
  {
    produit: "Lettre Verte",
    type_denvoi: "Envois du quotidien - Solution d'envoi standard du courrier",
    poids_max_en_g_avec_supplement: 20,
    tarifs_nets_unitaires_en_euro: 1.3,
  },
  {
    produit: "Lettre Verte",
    type_denvoi: "Envois du quotidien - Solution d'envoi standard du courrier",
    poids_max_en_g_avec_supplement: 50,
    tarifs_nets_unitaires_en_euro: 2.16,
  },
  {
    produit: "Lettre Verte",
    type_denvoi: "Envois du quotidien - Solution d'envoi standard du courrier",
    poids_max_en_g_avec_supplement: 100,
    tarifs_nets_unitaires_en_euro: 3.14,
  },
];

const colissimoDomicile: LaPosteLine[] = [
  {
    produit: "Colissimo Domicile",
    type_denvoi: "Colis en France Metropolitaine",
    poids_max_en_g_avec_supplement: 250,
    tarif_ht_en_euro: 6.84,
  },
  {
    produit: "Colissimo Domicile",
    type_denvoi: "Colis en France Metropolitaine",
    poids_max_en_g_avec_supplement: 500,
    tarif_ht_en_euro: 7.71,
  },
  {
    produit: "Colissimo Domicile",
    type_denvoi: "Colis en France Metropolitaine",
    poids_max_en_g_avec_supplement: 750,
    tarif_ht_en_euro: 8.6,
  },
  // Supplément sans poids : à ignorer.
  {
    produit: "Colissimo Domicile",
    type_denvoi: "Colis en France Metropolitaine",
    poids_max_en_g_avec_supplement: null,
    tarif_ht_en_euro: 1.1,
  },
  // Autre type d'envoi (international) : à ignorer.
  {
    produit: "Colissimo Domicile",
    type_denvoi: "La livraison de vos colis avec le choix",
    poids_max_en_g_avec_supplement: 250,
    tarif_ht_en_euro: 99,
  },
];

describe("parseCarrierTiers", () => {
  it("garde le tarif net des lettres tel quel, trié par poids", () => {
    expect(parseCarrierTiers("LA_POSTE_VERTE", [...lettreVerte].reverse())).toEqual([
      [20, 1.3],
      [50, 2.16],
      [100, 3.14],
    ]);
  });

  it("convertit le tarif HT de Colissimo en TTC (×1,20)", () => {
    expect(parseCarrierTiers("COLISSIMO_DOMICILE", colissimoDomicile)).toEqual([
      [250, 8.21],
      [500, 9.25],
      [750, 10.32],
    ]);
  });

  it("ignore les lignes d'un autre produit", () => {
    expect(parseCarrierTiers("COLISSIMO_RETRAIT", colissimoDomicile)).toEqual([]);
    expect(parseCarrierTiers("LA_POSTE_SUIVIE", lettreVerte)).toEqual([]);
  });
});

describe("assertPlausibleTiers", () => {
  it("accepte un barème croissant", () => {
    expect(() =>
      assertPlausibleTiers("LA_POSTE_VERTE", [
        [20, 1.3],
        [50, 2.16],
        [100, 3.14],
      ]),
    ).not.toThrow();
  });

  it("refuse un barème trop court", () => {
    expect(() => assertPlausibleTiers("LA_POSTE_VERTE", [[20, 1.3]])).toThrow(/incomplet/);
  });

  it("refuse un prix qui baisse quand le poids monte", () => {
    expect(() =>
      assertPlausibleTiers("LA_POSTE_VERTE", [
        [20, 3],
        [50, 2],
        [100, 4],
      ]),
    ).toThrow(/non croissant/);
  });

  it("refuse un prix nul", () => {
    expect(() =>
      assertPlausibleTiers("LA_POSTE_VERTE", [
        [20, 0],
        [50, 2],
        [100, 4],
      ]),
    ).toThrow(/invalide/);
  });
});
