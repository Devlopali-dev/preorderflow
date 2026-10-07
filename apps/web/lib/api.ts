import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "./auth";
import { CUSTOMER_AUTH_COOKIE_NAME } from "./customer-auth";
import { forwardedForHeader } from "./forwarded-ip";
import type { CarrierCode, CarrierTariffs } from "./shipping-tariffs";

// Un 401 de l'API veut dire « session invalide » (jeton expiré, compte supprimé
// ou désactivé, base réinitialisée), pas une panne : on renvoie vers la
// connexion plutôt que de faire planter la page. Pour l'admin, la route
// session-expired efface aussi le cookie périmé (un Server Component ne peut pas
// le faire, et le middleware ne regarde que sa présence).
function assertOk(res: Response): void {
  if (res.status === 401) redirect("/api/auth/session-expired");
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
}

// Même principe pour l'espace client (magic link) : retour à la connexion client.
function assertCustomerOk(res: Response): void {
  if (res.status === 401) redirect("/mon-compte/connexion");
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
}

// URL de l'API côté serveur (réseau interne) — côté client, utiliser
// NEXT_PUBLIC_API_URL directement dans les composants "use client".
export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Pour les pages admin (Server Components) : lit le cookie de session posé
// par /api/auth/login et l'attache en Authorization. Sans token, l'appel
// échoue en 401 côté API — c'est elle la seule source de vérité sur
// l'autorisation (CLAUDE.md §26), jamais le frontend.
async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return { ...(await visitorHeaders()), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// L'API limite le débit par IP : à la place du visiteur, le serveur Next lui transmet son adresse
// (cf. lib/forwarded-ip.ts), sinon tous les visiteurs partageraient celle du serveur web.
async function visitorHeaders(): Promise<Record<string, string>> {
  return forwardedForHeader(await headers());
}

// Même principe pour l'espace client (Server Components sous /mon-compte),
// avec le cookie de session client — jamais interchangeable avec le
// cookie admin (cf. lib/customer-auth.ts).
async function customerAuthHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(CUSTOMER_AUTH_COOKIE_NAME)?.value;
  return { ...(await visitorHeaders()), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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
// Photo d'un produit : 3 au plus, la première est la principale.
export interface ProductPhoto {
  id: string;
  url: string;
  position: number;
}

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
  imageUrl: string | null;
  documentUrl: string | null;
  paymentLink?: string | null;
  shippingEnabled?: boolean;
  startDate: string | null;
  endDate: string | null;
  media: CampaignMedia[];
  product?: {
    price: string;
    currency: string;
    // Poids unitaire en kg (peut être absent).
    weight: string | null;
    // Photos du produit, la première est la principale.
    photos: ProductPhoto[];
    variants: CampaignVariantOption[];
  };
}

// Lecture publique, mais le jeton admin (cookie) est transmis s'il existe : un administrateur voit
// aussi les campagnes en brouillon, introuvables (404) pour un visiteur.
export async function getCampaign(slug: string): Promise<Campaign | null> {
  const res = await fetch(`${API_URL}/api/v1/campaigns/${slug}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  assertOk(res);
  return res.json();
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${API_URL}/api/v1/campaigns`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  assertOk(res);
  return res.json();
}

export interface DashboardOverview {
  activeCampaigns: number;
  totalInterests: number;
  interestPeople: number;
  interestQuantity: number;
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
  return res.json();
}

export interface CustomerAddress {
  id: string;
  type: "BILLING" | "SHIPPING";
  firstName: string;
  lastName: string;
  company: string | null;
  address1: string;
  address2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}

export interface CustomerDetail extends CustomerSummary {
  phone: string | null;
  addresses: CustomerAddress[];
  orders: Array<{ id: string; number: string; status: string; total: string; currency: string }>;
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
  shipping: ShippingConfig;
  templates: string[];
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_URL}/api/v1/settings`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
  return res.json();
}

export interface OrderDetail extends OrderSummary {
  deliveryMethod: "SHIPPING" | "PICKUP";
  carrier: CarrierCode | null;
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
    metadata: { paymentLink?: string; revolutLink?: string; stripeCheckoutUrl?: string } | null;
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
  documentUrl: string | null;
  photos: ProductPhoto[];
  variants: ProductVariant[];
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/v1/products`, {
    cache: "no-store",
    headers: await visitorHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
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
    headers: await authHeaders(),
  });
  assertOk(res);
  return res.json();
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const res = await fetch(`${API_URL}/api/v1/orders/${id}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  assertOk(res);
  return res.json();
}

// --- Espace client (Server Components sous /mon-compte) ---

export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  addresses?: Array<{
    id: string;
    type: "BILLING" | "SHIPPING";
    address1: string;
    address2: string | null;
    postalCode: string;
    city: string;
    country: string;
  }>;
}

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const res = await fetch(`${API_URL}/api/v1/customer/me`, {
    cache: "no-store",
    headers: await customerAuthHeaders(),
  });
  if (res.status === 401) return null;
  assertCustomerOk(res);
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
    headers: await customerAuthHeaders(),
  });
  assertCustomerOk(res);
  return res.json();
}

export interface CustomerOrderDetail extends CustomerOrderSummary {
  deliveryMethod: "SHIPPING" | "PICKUP";
  paymentStatus: string;
  fulfillmentStatus: string;
  payments: Array<{
    status: string;
    amount: string;
    provider: string;
    metadata: { paymentLink?: string } | null;
  }>;
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
    headers: await customerAuthHeaders(),
  });
  if (res.status === 404) return null;
  assertCustomerOk(res);
  return res.json();
}

export interface ShippingConfig {
  flatRate: number;
  freeThreshold: number | null;
  packagingWeightGrams: number;
  // Barème par transporteur : défaut du code ou tarifs La Poste synchronisés.
  tariffs: CarrierTariffs;
  // Date de la dernière synchro La Poste (ISO) ; null = barème par défaut.
  tariffsSyncedAt: string | null;
}

// Barème public : en cas d'échec on n'affiche simplement pas les frais (l'API les applique quand même).
export async function getShippingConfig(): Promise<ShippingConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/settings/shipping`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
