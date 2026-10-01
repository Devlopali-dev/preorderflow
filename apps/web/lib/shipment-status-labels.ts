// Libellés français des statuts d'expédition (Shipment.status), partagés par
// l'administration et l'espace client. Fichier séparé de lib/api.ts (qui importe
// next/headers) pour rester importable depuis les composants client.
//
// Les codes (SHIPPED, IN_TRANSIT…) restent ceux de l'API ; seuls les libellés
// affichés sont traduits.

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  LABEL_CREATED: "Étiquette créée",
  SHIPPED: "Expédié",
  IN_TRANSIT: "En transit",
  OUT_FOR_DELIVERY: "En cours de livraison",
  DELIVERED: "Livré",
  EXCEPTION: "Incident",
  RETURNED: "Retourné",
};

// Intitulé du bouton qui fait passer une expédition à ce statut.
export const SHIPMENT_STATUS_ACTION_LABEL: Record<string, string> = {
  LABEL_CREATED: "Marquer étiquette créée",
  SHIPPED: "Marquer expédié",
  IN_TRANSIT: "Marquer en transit",
  OUT_FOR_DELIVERY: "Marquer en cours de livraison",
  DELIVERED: "Marquer livré",
  EXCEPTION: "Signaler un incident",
};

export function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABEL[status] ?? status;
}

export function shipmentStatusActionLabel(status: string): string {
  return SHIPMENT_STATUS_ACTION_LABEL[status] ?? `Passer à ${shipmentStatusLabel(status)}`;
}
