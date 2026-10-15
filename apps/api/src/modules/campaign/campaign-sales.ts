import type { OrderStatus } from "@preorderflow/database";

// Une commande compte comme une vente dès qu'elle est payée et tant qu'elle n'est ni annulée
// ni remboursée.
export const SOLD_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
];

interface SoldOrder {
  campaignId: string | null;
  items: { quantity: number }[];
}

export function sumSalesByCampaign(orders: SoldOrder[]): Record<string, number> {
  const sales: Record<string, number> = {};
  for (const order of orders) {
    if (!order.campaignId) continue;
    const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    sales[order.campaignId] = (sales[order.campaignId] ?? 0) + quantity;
  }
  return sales;
}
