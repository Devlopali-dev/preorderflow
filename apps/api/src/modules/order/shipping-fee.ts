import {
  type CarrierCode,
  type CarrierTariffs,
  carriersFor,
  carrierRate,
} from "./shipping-tariffs";

export type { CarrierCode };

export interface ShippingConfig {
  // Forfait historique, utilisé seulement quand aucun transporteur n'est retenu.
  flatRate: number;
  // Sous-total HT à partir duquel la livraison est offerte ; null = jamais offerte.
  freeThreshold: number | null;
  // Emballage + calage, ajoutés au poids des articles.
  packagingWeightGrams: number;
  // Barème par transporteur : défaut du code, remplacé par la synchro La Poste.
  tariffs: CarrierTariffs;
  // Date de la dernière synchro La Poste (ISO) ; null = barème par défaut.
  tariffsSyncedAt: string | null;
}

// Poids de l'envoi : articles + emballage.
export function parcelWeightGrams(goodsGrams: number, config: ShippingConfig): number {
  return goodsGrams + config.packagingWeightGrams;
}

// Tarif du transporteur choisi (tranche de poids), offert si le sous-total HT atteint le seuil
// de gratuité.
export function computeShippingAmount(
  subtotal: number,
  config: ShippingConfig,
  carrier?: CarrierCode | null,
  weightGrams = 0,
): number {
  if (config.freeThreshold !== null && subtotal >= config.freeThreshold) {
    return 0;
  }
  if (!carrier) return Math.round(config.flatRate * 100) / 100;
  const rate = carrierRate(config.tariffs, carrier, weightGrams);
  if (rate === null) throw new Error(`Poids ${weightGrams} g hors barème ${carrier}`);
  return Math.round(rate * 100) / 100;
}

// Remise en main propre : jamais de frais, quel que soit le barème ; un montant explicite
// (saisie admin) ne s'applique qu'à une livraison.
export function resolveShippingAmount(
  deliveryMethod: "SHIPPING" | "PICKUP",
  subtotal: number,
  config: ShippingConfig,
  explicitAmount?: number,
  carrier?: CarrierCode | null,
  weightGrams = 0,
): number {
  if (deliveryMethod === "PICKUP") return 0;
  return explicitAmount ?? computeShippingAmount(subtotal, config, carrier, weightGrams);
}

// Transporteur retenu pour une commande : aucun en main propre ; sinon le choix demandé
// (refusé s'il ne couvre pas ce poids) ou, par défaut, le premier transporteur disponible.
export function resolveCarrier(
  deliveryMethod: "SHIPPING" | "PICKUP",
  weightGrams: number,
  config: ShippingConfig,
  requested?: CarrierCode | null,
): CarrierCode | null {
  if (deliveryMethod === "PICKUP") return null;
  const allowed = carriersFor(config.tariffs, weightGrams);
  if (allowed.length === 0) {
    throw new Error(`Aucun transporteur ne couvre un envoi de ${weightGrams} g`);
  }
  if (requested == null) return allowed[0]!;
  if (!allowed.includes(requested)) {
    throw new Error(`Transporteur ${requested} indisponible pour un envoi de ${weightGrams} g`);
  }
  return requested;
}
