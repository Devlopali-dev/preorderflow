// Libellés français des termes de paiement, partagés par l'administration et
// l'espace client. Fichier séparé de lib/api.ts (qui importe next/headers) pour
// rester importable depuis les composants client.

// Mode de paiement d'un règlement (Payment.provider).
export const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  MANUAL: "Manuel (Revolut)",
  BANK_TRANSFER: "Virement bancaire",
  CASH: "Espèces",
  STRIPE: "Carte bancaire (Stripe)",
};

// Statut d'un règlement (Payment.status).
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "en attente",
  AUTHORIZED: "autorisé",
  PAID: "reçu",
  FAILED: "échoué",
  REFUNDED: "remboursé",
  PARTIALLY_REFUNDED: "partiellement remboursé",
};

// Statut de paiement d'une commande (Order.paymentStatus).
export const ORDER_PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  REFUNDED: "Remboursée",
};

export const ORDER_PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: "badge-default",
  PARTIALLY_PAID: "badge-warning",
  PAID: "badge-success",
  REFUNDED: "badge-warning",
};

export function paymentProviderLabel(provider: string): string {
  return PAYMENT_PROVIDER_LABEL[provider] ?? provider;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function orderPaymentStatusLabel(status: string): string {
  return ORDER_PAYMENT_STATUS_LABEL[status] ?? status;
}
