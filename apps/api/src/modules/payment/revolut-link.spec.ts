import { describe, expect, it } from "vitest";
import { buildRevolutPaymentLink } from "./revolut-link";

describe("buildRevolutPaymentLink", () => {
  it("met le montant en centimes dans le paramètre amount", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 3)).toBe(
      "https://revolut.me/jeff?currency=EUR&amount=300",
    );
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 6)).toBe(
      "https://revolut.me/jeff?currency=EUR&amount=600",
    );
  });

  it("complète le lien du .env qui se termine par `amount=`", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff?currency=EUR&amount=", 15)).toBe(
      "https://revolut.me/jeff?currency=EUR&amount=1500",
    );
  });

  it("remplace un montant déjà présent et garde la devise du lien", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff?currency=GBP&amount=999", 2.5)).toBe(
      "https://revolut.me/jeff?currency=GBP&amount=250",
    );
  });

  it("arrondit au centime", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 9.999)).toBe(
      "https://revolut.me/jeff?currency=EUR&amount=1000",
    );
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 19.9)).toBe(
      "https://revolut.me/jeff?currency=EUR&amount=1990",
    );
  });

  it("utilise la devise de la commande quand le lien n'en précise pas", () => {
    expect(buildRevolutPaymentLink("https://revolut.me/jeff", 4, "USD")).toBe(
      "https://revolut.me/jeff?currency=USD&amount=400",
    );
  });

  it("laisse tel quel un lien qui n'est pas Revolut.me", () => {
    expect(buildRevolutPaymentLink("https://pay.example.com/boutique", 12)).toBe(
      "https://pay.example.com/boutique",
    );
  });

  it("renvoie un lien illisible sans planter", () => {
    expect(buildRevolutPaymentLink("pas un lien", 5)).toBe("pas un lien");
  });
});
