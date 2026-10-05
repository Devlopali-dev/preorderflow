// Transporteurs et calcul de tarif côté client. Le barème lui-même vient de l'API
// (GET /api/v1/settings/shipping → tariffs) : défaut du code ou tarifs La Poste synchronisés. Ce
// module n'a aucune dépendance serveur (importé par des composants client) ; il doit rester
// aligné avec apps/api/src/modules/order/shipping-tariffs.ts.

export const CARRIER_CODES = [
  "LA_POSTE_SUIVIE",
  "LA_POSTE_VERTE",
  "COLISSIMO_RETRAIT",
  "COLISSIMO_DOMICILE",
  "MONDIAL_RELAY_POINT",
  "MONDIAL_RELAY_DOMICILE",
] as const;

export type CarrierCode = (typeof CARRIER_CODES)[number];

export const CARRIER_LABELS: Record<CarrierCode, string> = {
  LA_POSTE_SUIVIE: "La Poste, Lettre Verte Suivie",
  LA_POSTE_VERTE: "La Poste, Lettre Verte",
  COLISSIMO_RETRAIT: "La Poste, Colissimo point de retrait",
  COLISSIMO_DOMICILE: "La Poste, Colissimo à domicile",
  MONDIAL_RELAY_POINT: "Mondial Relay, Point Relais",
  MONDIAL_RELAY_DOMICILE: "Mondial Relay, à domicile",
};

// [poids max en g, prix en €]
export type Tier = readonly [maxGrams: number, price: number];

export type CarrierTariffs = Record<CarrierCode, ReadonlyArray<Tier>>;

// Prix du transporteur pour ce poids ; null si le poids dépasse sa dernière tranche.
export function carrierRate(
  tariffs: CarrierTariffs,
  carrier: CarrierCode,
  weightGrams: number,
): number | null {
  const tier = tariffs[carrier].find(([maxGrams]) => weightGrams <= maxGrams);
  return tier ? tier[1] : null;
}

// Transporteurs capables d'acheminer ce poids, dans l'ordre d'affichage.
export function carriersFor(tariffs: CarrierTariffs, weightGrams: number): CarrierCode[] {
  return CARRIER_CODES.filter((carrier) => carrierRate(tariffs, carrier, weightGrams) !== null);
}
