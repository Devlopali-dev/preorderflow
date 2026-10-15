import { describe, expect, it } from "vitest";
import { SOLD_ORDER_STATUSES, sumSalesByCampaign } from "./campaign-sales";

describe("sumSalesByCampaign", () => {
  it("additionne les quantités des lignes par campagne", () => {
    expect(
      sumSalesByCampaign([
        { campaignId: "a", items: [{ quantity: 2 }, { quantity: 1 }] },
        { campaignId: "a", items: [{ quantity: 4 }] },
        { campaignId: "b", items: [{ quantity: 5 }] },
      ]),
    ).toEqual({ a: 7, b: 5 });
  });

  it("ignore les commandes sans campagne", () => {
    expect(sumSalesByCampaign([{ campaignId: null, items: [{ quantity: 3 }] }])).toEqual({});
  });

  it("ne compte que les commandes payées et non annulées", () => {
    expect(SOLD_ORDER_STATUSES).not.toContain("DRAFT");
    expect(SOLD_ORDER_STATUSES).not.toContain("PENDING_PAYMENT");
    expect(SOLD_ORDER_STATUSES).not.toContain("CANCELLED");
    expect(SOLD_ORDER_STATUSES).not.toContain("REFUNDED");
    expect(SOLD_ORDER_STATUSES).toContain("PAID");
  });
});
