import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "./auth";
import { CUSTOMER_AUTH_COOKIE_NAME } from "./customer-auth";

// URL de l'API côté serveur (réseau interne) — côté client, utiliser
// NEXT_PUBLIC_API_URL directement dans les composants "use client".
export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Pour les pages admin (Server Components) : lit le cookie de session posé
// par /api/auth/login et l'attache en Authorization. Sans token, l'appel
// échoue en 401 côté API — c'est elle la seule source de vérité sur
// l'autorisation (CLAUDE.md §26), jamais le frontend.
function authHeaders(): Record<string, string> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Même principe pour l'espace client (Server Components sous /mon-compte),
// avec le cookie de session client — jamais interchangeable avec le
// cookie admin (cf. lib/customer-auth.ts).
function customerAuthHeaders(): Record<string, string> {
  const token = cookies().get(CUSTOMER_AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CampaignMedia {
  id: string;
  url: string;
  type: "IMAGE" | "DOCUMENT";
  position: number;
  thumbnailUrl?: string | null;
}

// Palette globale (/settings) — une couleur = un nom + une pastille #rrggbb.
export interface Color {
  id: string;
  name: string;
  hex: string;
  active: boolean;
  _count?: { variants: number };
}

// Unité vendable et stockable d'un produit. `color` est null pour la variante
// par défaut d'un produit sans couleur.
export interface ProductVariant {
  id: string;
  sku: string;
  active: boolean;
  colorId: string | null;
  color: Color | null;
}

// Ce que la page publique d'une campagne reçoit : id + couleur d'affichage,
// jamais de stock ni de SKU.
export interface CampaignVariantOption {
  id: string;
  color: { name: string; hex: string } | null;
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
  documentUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  media: CampaignMedia[];
  product?: { variants: CampaignVariantOption[] };
}

export async function getCampaign(slug: string): Promise<Campaign | null> {
  const res = await fetch(`${API_URL}/api/v1/campaigns/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${API_URL}/api/v1/campaigns`, { cache: "no-store" });
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
  const res = await fetch(`${API_URL}/api/v1/dashboard`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
  const res = await fetch(`${API_URL}/api/v1/orders`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
  const res = await fetch(`${API_URL}/api/v1/customers`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface CustomerDetail extends CustomerSummary {
  phone: string | null;
  addresses: Array<{
    id: string;
    address1: string;
    city: string;
    postalCode: string;
    country: string;
  }>;
  orders: Array<{ id: string; number: string; status: string; total: string; currency: string }>;
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_URL}/api/v1/audit-logs`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface Settings {
  businessName: string | null;
  contactEmail: string | null;
  email: {
    provider: string | null;
    resendConfigured: boolean;
    smtpConfigured: boolean;
    from: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    active: boolean;
  };
  ntfy: { configured: boolean; url: string; topic: string | null };
  templates: string[];
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_URL}/api/v1/settings`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface AdminProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "OPERATOR";
}

export async function getAdminProfile(): Promise<AdminProfile> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface NotificationTemplateDetail {
  template: string;
  subject: string;
  html: string;
  customized: boolean;
  placeholders: string[];
}

export async function getNotificationTemplates(): Promise<NotificationTemplateDetail[]> {
  const res = await fetch(`${API_URL}/api/v1/settings/templates`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface OrderDetail extends OrderSummary {
  subtotal: string;
  shippingAmount: string;
  taxAmount: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string;
    variant: {
      sku: string;
      product: { name: string };
      color: { name: string; hex: string } | null;
    };
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: string;
    provider: string;
    metadata: { revolutLink?: string; stripeCheckoutUrl?: string } | null;
  }>;
  shipment: {
    id: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
}

export interface StockSnapshot {
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}

// Un produit fabricable : stock total (somme des variantes) et détail par
// variante/couleur.
export interface InventoryRow {
  product: { id: string; name: string; sku: string };
  stock: StockSnapshot;
  variants: Array<{ variant: ProductVariant; stock: StockSnapshot }>;
}

export async function getInventory(): Promise<InventoryRow[]> {
  const res = await fetch(`${API_URL}/api/v1/inventory`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency: string;
  taxRate: string;
  weight: string | null;
  active: boolean;
  imageUrl: string | null;
  documentUrl: string | null;
  variants: ProductVariant[];
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/v1/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface ProductionBatchSummary {
  id: string;
  reference: string;
  status: string;
  items: Array<{
    id: string;
    quantityPlanned: number;
    quantityProduced: number;
    variant: {
      id: string;
      sku: string;
      product: { id: string; name: string };
      color: { name: string; hex: string } | null;
    };
  }>;
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
  const res = await fetch(`${API_URL}/api/v1/shipments`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/orders/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

// --- Espace client (Server Components sous /mon-compte) ---

export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const res = await fetch(`${API_URL}/api/v1/customer/me`, {
    cache: "no-store",
    headers: customerAuthHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface CustomerOrderSummary {
  id: string;
  number: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  items: Array<{
    quantity: number;
    variant: { product: { name: string }; color: { name: string; hex: string } | null };
  }>;
  shipment: { status: string; trackingNumber: string | null } | null;
}

export async function getCustomerOrders(): Promise<CustomerOrderSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/customer/me/orders`, {
    cache: "no-store",
    headers: customerAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}

export interface CustomerOrderDetail extends CustomerOrderSummary {
  paymentStatus: string;
  fulfillmentStatus: string;
  payments: Array<{ status: string; amount: string }>;
  shipment:
    | (CustomerOrderSummary["shipment"] & {
        trackingUrl: string | null;
        carrier: string | null;
        events: Array<{ status: string; occurredAt: string }>;
      })
    | null;
}

export async function getCustomerOrder(id: string): Promise<CustomerOrderDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/customer/me/orders/${id}`, {
    cache: "no-store",
    headers: customerAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return res.json();
}
