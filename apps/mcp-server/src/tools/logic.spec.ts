import { describe, expect, it } from "vitest";
import {
  computeOrderStatistics,
  filterLowStockProducts,
  filterPendingOrders,
  summarizeProductionStatus,
  summarizeShipmentsStatus,
} from "./logic";
import type { InventoryRow, Order, ProductionBatch, Shipment } from "../types";

function order(overrides: Partial<Order>): Order {
  return {
    id: "1",
    number: "2026-0001",
    status: "PAID",
    paymentStatus: "PAID",
    fulfillmentStatus: "UNFULFILLED",
    total: "15",
    currency: "EUR",
    createdAt: "2026-01-01T00:00:00.000Z",
    customer: { firstName: "A", lastName: "B", email: "a@b.com" },
    items: [{ quantity: 2, product: { name: "Stylo", sku: "STYLO-001" } }],
    ...overrides,
  };
}

describe("computeOrderStatistics", () => {
  it("exclut les commandes annulées/remboursées du total d'unités commandées", () => {
    const stats = computeOrderStatistics([
      order({ status: "PAID" }),
      order({ status: "CANCELLED" }),
      order({ status: "REFUNDED" }),
    ]);
    expect(stats.totalOrders).toBe(3);
    expect(stats.totalUnitsOrdered).toBe(2);
  });

  it("agrège les unités par SKU produit", () => {
    const stats = computeOrderStatistics([
      order({ items: [{ quantity: 3, product: { name: "Stylo", sku: "STYLO-001" } }] }),
      order({ items: [{ quantity: 1, product: { name: "Stylo", sku: "STYLO-001" } }] }),
    ]);
    expect(stats.unitsOrderedByProductSku["STYLO-001"]).toBe(4);
  });
});

describe("filterLowStockProducts", () => {
  const rows: InventoryRow[] = [
    {
      product: { id: "1", name: "A", sku: "A" },
      stock: { physicalStock: 5, reservedStock: 0, availableStock: 5 },
    },
    {
      product: { id: "2", name: "B", sku: "B" },
      stock: { physicalStock: 50, reservedStock: 0, availableStock: 50 },
    },
  ];

  it("ne retient que les produits sous le seuil", () => {
    const low = filterLowStockProducts(rows, 10);
    expect(low).toHaveLength(1);
    expect(low[0]!.sku).toBe("A");
  });
});

describe("filterPendingOrders", () => {
  it("exclut les commandes terminales (livrée/annulée/remboursée)", () => {
    const pending = filterPendingOrders([
      order({ status: "PAID" }),
      order({ status: "DELIVERED" }),
      order({ status: "CANCELLED" }),
      order({ status: "READY_TO_SHIP" }),
    ]);
    expect(pending).toHaveLength(2);
    expect(pending.map((o) => o.status).sort()).toEqual(["PAID", "READY_TO_SHIP"]);
  });
});

describe("summarizeProductionStatus", () => {
  function batch(overrides: Partial<ProductionBatch>): ProductionBatch {
    return {
      id: "1",
      reference: "2026-001",
      status: "IN_PROGRESS",
      items: [
        {
          quantityPlanned: 100,
          quantityProduced: 40,
          product: { name: "Stylo", sku: "STYLO-001" },
        },
      ],
      ...overrides,
    };
  }

  it("calcule le reste à produire seulement pour les lots actifs", () => {
    const summary = summarizeProductionStatus([
      batch({ status: "IN_PROGRESS" }),
      batch({
        status: "COMPLETED",
        items: [{ quantityPlanned: 50, quantityProduced: 50, product: { name: "X", sku: "X" } }],
      }),
    ]);
    expect(summary.remainingToProduceByProductSku["STYLO-001"]).toBe(60);
    expect(summary.remainingToProduceByProductSku["X"]).toBeUndefined();
    expect(summary.activeBatches).toHaveLength(1);
  });
});

describe("summarizeShipmentsStatus", () => {
  function shipment(overrides: Partial<Shipment>): Shipment {
    return {
      id: "1",
      status: "SHIPPED",
      carrier: "Colissimo",
      trackingNumber: "TRACK-1",
      order: { number: "2026-0001" },
      ...overrides,
    };
  }

  it("compte par statut et liste les non livrées", () => {
    const summary = summarizeShipmentsStatus([
      shipment({ status: "SHIPPED" }),
      shipment({ status: "DELIVERED" }),
      shipment({ status: "IN_TRANSIT" }),
    ]);
    expect(summary.byStatus).toEqual({ SHIPPED: 1, DELIVERED: 1, IN_TRANSIT: 1 });
    expect(summary.notDelivered).toHaveLength(2);
  });
});
