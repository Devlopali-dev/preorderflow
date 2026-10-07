import { describe, expect, it } from "vitest";
import {
  assertOrderHandDeliverable,
  assertOrderPaidForDelivery,
  OrderNotHandDeliverableError,
  OrderNotPaidError,
} from "./order-rules";

describe("assertOrderHandDeliverable", () => {
  it.each(["PROCESSING", "READY_TO_SHIP"])("accepte une commande %s", (status) => {
    expect(() => assertOrderHandDeliverable(status)).not.toThrow();
  });

  it.each(["DRAFT", "PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"])(
    "refuse une commande %s",
    (status) => {
      expect(() => assertOrderHandDeliverable(status)).toThrow(OrderNotHandDeliverableError);
    },
  );
});

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
