import { describe, expect, it } from "vitest";
import { assertValidCampaignTransition, InvalidCampaignTransitionError } from "./campaign-status";

describe("assertValidCampaignTransition", () => {
  it("autorise le chemin nominal complet", () => {
    const path: Array<Parameters<typeof assertValidCampaignTransition>> = [
      ["DRAFT", "RECENSEMENT"],
      ["RECENSEMENT", "COMMANDES_OUVERTES"],
      ["COMMANDES_OUVERTES", "COMMANDES_FERMEES"],
      ["COMMANDES_FERMEES", "PRODUCTION"],
      ["PRODUCTION", "EXPEDITION"],
      ["EXPEDITION", "TERMINEE"],
    ];
    for (const [from, to] of path) {
      expect(() => assertValidCampaignTransition(from, to)).not.toThrow();
    }
  });

  it("autorise l'annulation depuis n'importe quel statut non terminal", () => {
    expect(() => assertValidCampaignTransition("DRAFT", "ANNULEE")).not.toThrow();
    expect(() => assertValidCampaignTransition("RECENSEMENT", "ANNULEE")).not.toThrow();
    expect(() => assertValidCampaignTransition("COMMANDES_OUVERTES", "ANNULEE")).not.toThrow();
    expect(() => assertValidCampaignTransition("COMMANDES_FERMEES", "ANNULEE")).not.toThrow();
    expect(() => assertValidCampaignTransition("PRODUCTION", "ANNULEE")).not.toThrow();
    expect(() => assertValidCampaignTransition("EXPEDITION", "ANNULEE")).not.toThrow();
  });

  it("refuse un retour en arrière", () => {
    expect(() => assertValidCampaignTransition("COMMANDES_FERMEES", "RECENSEMENT")).toThrow(
      InvalidCampaignTransitionError,
    );
  });

  it("refuse un saut d'étape", () => {
    expect(() => assertValidCampaignTransition("DRAFT", "PRODUCTION")).toThrow(
      InvalidCampaignTransitionError,
    );
  });

  it("refuse toute transition depuis un état terminal", () => {
    expect(() => assertValidCampaignTransition("TERMINEE", "DRAFT")).toThrow(
      InvalidCampaignTransitionError,
    );
    expect(() => assertValidCampaignTransition("ANNULEE", "DRAFT")).toThrow(
      InvalidCampaignTransitionError,
    );
  });

  it("tolère une transition vers le même statut (no-op)", () => {
    expect(() => assertValidCampaignTransition("RECENSEMENT", "RECENSEMENT")).not.toThrow();
  });
});
