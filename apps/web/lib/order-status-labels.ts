// Libellés français des statuts de commande (Order.status), partagés par
// l'administration et l'espace client. Fichier séparé de lib/api.ts (qui importe
// next/headers) pour rester importable depuis les composants client.
//
// Les codes (DRAFT, PAID…) restent ceux de l'API : ils servent d'identifiants
// (ancres, requêtes), seuls les libellés affichés sont traduits.

export const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PROCESSING: "En préparation",
  READY_TO_SHIP: "Prête à expédier",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

// Intitulé du bouton qui fait passer une commande à ce statut.
export const ORDER_STATUS_ACTION_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Passer en attente de paiement",
  PROCESSING: "Passer en préparation",
  READY_TO_SHIP: "Marquer prête à expédier",
  CANCELLED: "Annuler",
  REFUNDED: "Rembourser",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function orderStatusActionLabel(status: string): string {
  return ORDER_STATUS_ACTION_LABEL[status] ?? `Passer à ${orderStatusLabel(status)}`;
}
