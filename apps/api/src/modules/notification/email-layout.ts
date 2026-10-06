import { prisma } from "@preorderflow/database";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(value: { toString(): string } | number, currency: string): string {
  const text = Number(value.toString()).toFixed(2).replace(".", ",");
  return currency === "EUR" ? `${text} €` : `${text} ${currency}`;
}

// Styles en ligne : la plupart des clients mail ignorent les <style> externes.
const CELL = "padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;";

interface OrderItemsSource {
  currency: string;
  subtotal: { toString(): string };
  shippingAmount: { toString(): string };
  total: { toString(): string };
  items: Array<{
    quantity: number;
    unitPrice: { toString(): string };
    total: { toString(): string };
    variant: { product: { name: string }; color: { name: string } | null };
  }>;
}

// Tableau HTML des produits commandés, injecté via le placeholder {{items}}.
export function renderOrderItemsTable(order: OrderItemsSource): string {
  const rows = order.items
    .map((item) => {
      const name = item.variant.color
        ? `${item.variant.product.name} — ${item.variant.color.name}`
        : item.variant.product.name;
      return `<tr><td style="${CELL}">${escapeHtml(name)}</td><td style="${CELL}text-align:center;">${item.quantity}</td><td style="${CELL}text-align:right;white-space:nowrap;">${formatAmount(item.unitPrice, order.currency)}</td><td style="${CELL}text-align:right;white-space:nowrap;">${formatAmount(item.total, order.currency)}</td></tr>`;
    })
    .join("");
  const th =
    "padding:8px 0;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;";
  const foot = (label: string, value: string, bold = false) =>
    `<tr><td colspan="3" style="padding:6px 0;text-align:right;font-size:14px;color:#1f2937;${bold ? "font-weight:700;" : ""}">${label}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;font-size:14px;color:#1f2937;${bold ? "font-weight:700;" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;"><thead><tr><th align="left" style="${th}">Produit</th><th style="${th}">Qté</th><th align="right" style="${th}">Prix unitaire</th><th align="right" style="${th}">Total</th></tr></thead><tbody>${rows}</tbody><tfoot>${foot("Sous-total", formatAmount(order.subtotal, order.currency))}${foot("Livraison", Number(order.shippingAmount.toString()) === 0 ? "Offerte" : formatAmount(order.shippingAmount, order.currency))}${foot("Total", formatAmount(order.total, order.currency), true)}</tfoot></table>`;
}

// Charge la commande et rend son tableau ; chaîne vide si elle est introuvable
// (l'email part alors sans récapitulatif plutôt que de ne pas partir).
export async function loadOrderItemsHtml(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { variant: { include: { product: true, color: true } } } } },
  });
  return order ? renderOrderItemsTable(order) : "";
}

// Habillage commun de tous les emails : en-tête au nom de la boutique, carte
// centrée, pied discret. Appliqué aussi aux templates personnalisés.
export function wrapEmail(bodyHtml: string, businessName: string | null): string {
  const brand = escapeHtml(businessName?.trim() || "PreOrderFlow");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td style="background:#2563eb;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;">${brand}</td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.6;color:#1f2937;">${bodyHtml}</td></tr><tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:center;">Cet email vous est envoyé par ${brand}.</td></tr></table></td></tr></table></body></html>`;
}
