import { afterEach, describe, expect, it } from "vitest";
import { getStripeClient, isStripeConfigured } from "./stripe-client";

describe("stripe-client", () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("n'est pas configuré sans STRIPE_SECRET_KEY", () => {
    expect(isStripeConfigured()).toBe(false);
  });

  it("est configuré dès qu'une clé est présente", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    expect(isStripeConfigured()).toBe(true);
  });

  it("lève une erreur explicite plutôt que de planter au chargement du module", () => {
    expect(() => getStripeClient()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("construit un client sans erreur dès qu'une clé (même factice) est fournie", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    expect(() => getStripeClient()).not.toThrow();
  });
});
