export interface ShippingConfig {
  flatRate: number;
  // Sous-total HT à partir duquel la livraison est offerte ; null = jamais offerte.
  freeThreshold: number | null;
}

// Les frais sont un forfait par commande, offert si le sous-total HT atteint le seuil.
export function computeShippingAmount(subtotal: number, config: ShippingConfig): number {
  if (config.freeThreshold !== null && subtotal >= config.freeThreshold) {
    return 0;
  }
  return Math.round(config.flatRate * 100) / 100;
}

// Remise en main propre : jamais de frais, quel que soit le barème ; un montant explicite
// (saisie admin) ne s'applique qu'à une livraison.
export function resolveShippingAmount(
  deliveryMethod: "SHIPPING" | "PICKUP",
  subtotal: number,
  config: ShippingConfig,
  explicitAmount?: number,
): number {
  if (deliveryMethod === "PICKUP") return 0;
  return explicitAmount ?? computeShippingAmount(subtotal, config);
}
