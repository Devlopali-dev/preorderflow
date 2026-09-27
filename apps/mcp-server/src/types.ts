export interface CampaignStatistics {
  totalInterests: number;
  totalQuantity: number;
  averageQuantity: number;
  distribution: Array<{ quantity: number | "5+"; count: number }>;
  evolution: Array<{ date: string; count: number }>;
}

export interface OrderItem {
  quantity: number;
  product: { name: string; sku: string };
}

export interface Order {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
  items: OrderItem[];
}

export interface InventoryRow {
  product: { id: string; name: string; sku: string };
  stock: { physicalStock: number; reservedStock: number; availableStock: number };
}

export interface ProductionBatch {
  id: string;
  reference: string;
  status: string;
  items: Array<{
    quantityPlanned: number;
    quantityProduced: number;
    product: { name: string; sku: string };
  }>;
}

export interface Shipment {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  order: { number: string };
}
