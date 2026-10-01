import { describe, expect, it } from "vitest";
import { assertOrderAcceptsPayment, OrderNotPayableError } from "./payment-rules";

describe("assertOrderAcceptsPayment", () => {
  it("refuse une commande annulée ou remboursée", () => {
    expect(() => assertOrderAcceptsPayment("CANCELLED")).toThrow(OrderNotPayableError);
    expect(() => assertOrderAcceptsPayment("CANCELLED")).toThrow(/annulée/);
    expect(() => assertOrderAcceptsPayment("REFUNDED")).toThrow(/remboursée/);
  });

  it("accepte tous les autres statuts de commande", () => {
    for (const status of [
      "DRAFT",
      "PENDING_PAYMENT",
      "PAID",
      "PROCESSING",
      "READY_TO_SHIP",
      "SHIPPED",
      "DELIVERED",
    ]) {
      expect(() => assertOrderAcceptsPayment(status)).not.toThrow();
    }
  });
});
