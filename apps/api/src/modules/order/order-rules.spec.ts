import { describe, expect, it } from "vitest";
import { assertOrderPaidForDelivery, OrderNotPaidError } from "./order-rules";

describe("assertOrderPaidForDelivery", () => {
  it("accepte une commande payée", () => {
    expect(() => assertOrderPaidForDelivery("PAID")).not.toThrow();
  });

  it("refuse une commande non payée, partiellement payée ou remboursée", () => {
    for (const status of ["UNPAID", "PARTIALLY_PAID", "REFUNDED"]) {
      expect(() => assertOrderPaidForDelivery(status)).toThrow(OrderNotPaidError);
    }
  });

  it("indique l'état du paiement dans le message", () => {
    expect(() => assertOrderPaidForDelivery("UNPAID")).toThrow(/non payée.*UNPAID/);
  });
});
