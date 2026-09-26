import { describe, expect, it } from "vitest";
import { buildRevolutPaymentLink } from "./revolut-link";

describe("buildRevolutPaymentLink", () => {
  it("ajoute le montant formaté à 2 décimales au lien de base", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 15)).toBe(
      "https://revolut.me/jeff/15.00",
    );
  });

  it("retire un slash final en trop avant d'ajouter le montant", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff/", 21.5)).toBe(
      "https://revolut.me/jeff/21.50",
    );
  });

  it("gère les montants avec centimes", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 9.999)).toBe(
      "https://revolut.me/jeff/10.00",
    );
  });
});
