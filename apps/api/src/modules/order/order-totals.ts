export interface OrderLineInput {
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
  items: Array<{ quantity: number; unitPrice: number; taxRate: number; lineTotal: number }>;
}

// Le sous-total d'une ligne est HT ; la taxe est calculée par ligne pour
// tolérer des taux différents par produit, puis sommée.
export function computeOrderTotals(lines: OrderLineInput[], shippingAmount = 0): OrderTotals {
  const items = lines.map((line) => ({
    ...line,
    lineTotal: round2(line.quantity * line.unitPrice),
  }));

  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxAmount = round2(
    items.reduce((sum, item) => sum + item.lineTotal * (item.taxRate / 100), 0),
  );
  const total = round2(subtotal + taxAmount + shippingAmount);

  return { subtotal, taxAmount, total, items };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
