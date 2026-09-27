import type { InventoryRow, Order, ProductionBatch, Shipment } from "../types.js";

const NON_TERMINAL_ORDER_STATUSES = new Set([
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
]);

export function computeOrderStatistics(orders: Order[]) {
  const nonCancelled = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED");

  const totalUnitsOrdered = nonCancelled.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  const byStatus: Record<string, number> = {};
  for (const order of orders) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
  }

  const byProduct: Record<string, number> = {};
  for (const order of nonCancelled) {
    for (const item of order.items) {
      byProduct[item.product.sku] = (byProduct[item.product.sku] ?? 0) + item.quantity;
    }
  }

  return {
    totalOrders: orders.length,
    totalUnitsOrdered,
    byStatus,
    unitsOrderedByProductSku: byProduct,
  };
}

export function filterLowStockProducts(rows: InventoryRow[], threshold: number) {
  return rows
    .filter((r) => r.stock.availableStock < threshold)
    .map((r) => ({
      sku: r.product.sku,
      name: r.product.name,
      physicalStock: r.stock.physicalStock,
      reservedStock: r.stock.reservedStock,
      availableStock: r.stock.availableStock,
    }));
}

export function filterPendingOrders(orders: Order[]) {
  return orders
    .filter((o) => NON_TERMINAL_ORDER_STATUSES.has(o.status))
    .map((o) => ({
      number: o.number,
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      customer: `${o.customer.firstName} ${o.customer.lastName}`,
      total: `${o.total} ${o.currency}`,
    }));
}

export function summarizeProductionStatus(batches: ProductionBatch[]) {
  const active = batches.filter((b) => b.status === "PLANNED" || b.status === "IN_PROGRESS");

  const remainingByProduct: Record<string, number> = {};
  for (const batch of active) {
    for (const item of batch.items) {
      const remaining = item.quantityPlanned - item.quantityProduced;
      if (remaining > 0) {
        remainingByProduct[item.product.sku] = (remainingByProduct[item.product.sku] ?? 0) + remaining;
      }
    }
  }

  return {
    activeBatches: active.map((b) => ({
      reference: b.reference,
      status: b.status,
      items: b.items.map((i) => ({
        sku: i.product.sku,
        planned: i.quantityPlanned,
        produced: i.quantityProduced,
        remaining: i.quantityPlanned - i.quantityProduced,
      })),
    })),
    remainingToProduceByProductSku: remainingByProduct,
  };
}

export function summarizeShipmentsStatus(shipments: Shipment[]) {
  const byStatus: Record<string, number> = {};
  for (const shipment of shipments) {
    byStatus[shipment.status] = (byStatus[shipment.status] ?? 0) + 1;
  }

  const notDelivered = shipments
    .filter((s) => s.status !== "DELIVERED" && s.status !== "RETURNED")
    .map((s) => ({
      orderNumber: s.order.number,
      status: s.status,
      carrier: s.carrier,
      trackingNumber: s.trackingNumber,
    }));

  return { byStatus, notDelivered };
}
