import { describe, expect, it } from "vitest";
import { assertPaymentChoiceOpen, PaymentChoiceClosedError } from "./payment-choice-rules";

describe("assertPaymentChoiceOpen", () => {
  it("laisse choisir tant que la commande est en brouillon ou en attente de paiement", () => {
    expect(() => assertPaymentChoiceOpen("DRAFT")).not.toThrow();
    expect(() => assertPaymentChoiceOpen("PENDING_PAYMENT")).not.toThrow();
  });

  it("refuse une commande déjà réglée, avancée, annulée ou remboursée", () => {
    for (const status of [
      "PAID",
      "PROCESSING",
      "READY_TO_SHIP",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ]) {
      expect(() => assertPaymentChoiceOpen(status)).toThrow(PaymentChoiceClosedError);
    }
  });
});
