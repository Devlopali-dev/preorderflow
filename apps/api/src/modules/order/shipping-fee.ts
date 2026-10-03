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
