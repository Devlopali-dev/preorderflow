import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "./auth";

// URL de l'API côté serveur (réseau interne) — côté client, utiliser
// NEXT_PUBLIC_API_URL directement dans les composants "use client".
export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Pour les pages admin (Server Components) : lit le cookie de session posé
// par /api/auth/login et l'attache en Authorization. Sans token, l'appel
// échoue en 401 côté API — c'est elle la seule source de vérité sur
// l'autorisation (CLAUDE.md §26), jamais le frontend.
function authHeaders(): Record<string, string> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  indicativePrice: string;
  currency: string;
  imageUrl: string | null;
}

export async function getCampaign(slug: string): Promise<Campaign | null> {
  const res = await fetch(`${API_URL}/api/v1/campaigns/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface DashboardOverview {
  activeCampaigns: number;
  totalInterests: number;
  totalOrders: number;
  ordersToPay: number;
  ordersToPrepare: number;
  ordersToShip: number;
  productionInProgress: number;
  shipmentsInTransit: number;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await fetch(`${API_URL}/api/v1/dashboard`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
}

export async function getOrders(): Promise<OrderSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/orders`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface CustomerSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/customers`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface OrderDetail extends OrderSummary {
  subtotal: string;
  shippingAmount: string;
  taxAmount: string;
  items: Array<{ id: string; quantity: number; unitPrice: string; product: { name: string } }>;
  payments: Array<{
    id: string;
    status: string;
    amount: string;
    provider: string;
    metadata: { revolutLink?: string } | null;
  }>;
  shipment: {
    id: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
}

export interface InventoryRow {
  product: { id: string; name: string; sku: string };
  stock: { physicalStock: number; reservedStock: number; availableStock: number };
}

export async function getInventory(): Promise<InventoryRow[]> {
  const res = await fetch(`${API_URL}/api/v1/inventory`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface ProductionBatchSummary {
  id: string;
  reference: string;
  status: string;
  items: Array<{ quantityPlanned: number; quantityProduced: number; product: { name: string } }>;
}

export async function getProductionBatches(): Promise<ProductionBatchSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/production/batches`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface ShipmentSummary {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  order: { number: string };
}

export async function getShipments(): Promise<ShipmentSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/shipments`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/orders/${id}`, { cache: "no-store", headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}
