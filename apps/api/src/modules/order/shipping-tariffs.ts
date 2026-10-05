// Barème des transporteurs, France métropolitaine, TTC : [poids max en g, prix en €].
//
// DEFAULT_TARIFFS = barème de secours (tarifs publics 2026 de laposte.fr et mondialrelay.fr), utilisé
// tant qu'aucune synchro n'a eu lieu. Les tarifs La Poste / Colissimo sont ensuite remplacés par
// ceux de l'API data.laposte.fr (cf. laposte-tariffs.ts, bouton dans /settings). Mondial Relay n'a
// pas d'API publique : son barème reste celui du code, à mettre à jour chaque année.

export const CARRIER_CODES = [
  "LA_POSTE_SUIVIE",
  "LA_POSTE_VERTE",
  "COLISSIMO_RETRAIT",
  "COLISSIMO_DOMICILE",
  "MONDIAL_RELAY_POINT",
  "MONDIAL_RELAY_DOMICILE",
] as const;

export type CarrierCode = (typeof CARRIER_CODES)[number];

// Transporteurs dont le barème vient de l'API La Poste.
export const LA_POSTE_CARRIER_CODES = [
  "LA_POSTE_SUIVIE",
  "LA_POSTE_VERTE",
  "COLISSIMO_RETRAIT",
  "COLISSIMO_DOMICILE",
] as const satisfies ReadonlyArray<CarrierCode>;

export const CARRIER_LABELS: Record<CarrierCode, string> = {
  LA_POSTE_SUIVIE: "La Poste, Lettre Verte Suivie",
  LA_POSTE_VERTE: "La Poste, Lettre Verte",
  COLISSIMO_RETRAIT: "La Poste, Colissimo point de retrait",
  COLISSIMO_DOMICILE: "La Poste, Colissimo à domicile",
  MONDIAL_RELAY_POINT: "Mondial Relay, Point Relais",
  MONDIAL_RELAY_DOMICILE: "Mondial Relay, à domicile",
};

export type Tier = readonly [maxGrams: number, price: number];

export type CarrierTariffs = Record<CarrierCode, ReadonlyArray<Tier>>;

export const DEFAULT_TARIFFS: CarrierTariffs = {
  LA_POSTE_VERTE: [
    [20, 1.52],
    [100, 3.1],
    [250, 5.24],
    [500, 7.41],
    [1000, 9.29],
    [2000, 11.14],
  ],
  LA_POSTE_SUIVIE: [
    [20, 2.02],
    [100, 3.6],
    [250, 5.74],
    [500, 7.91],
    [1000, 9.79],
    [2000, 11.64],
  ],
  COLISSIMO_RETRAIT: [
    [250, 4.79],
    [500, 6.89],
    [750, 8.59],
    [1000, 8.89],
    [2000, 10.49],
    [5000, 16.69],
  ],
  COLISSIMO_DOMICILE: [
    [250, 5.49],
    [500, 7.59],
    [750, 9.29],
    [1000, 9.59],
    [2000, 11.19],
    [5000, 17.39],
    [10000, 25.29],
    [15000, 31.99],
    [30000, 39.59],
  ],
  MONDIAL_RELAY_POINT: [
    [250, 4.15],
    [500, 4.15],
    [1000, 5.99],
    [2000, 7.99],
    [3000, 7.99],
    [4000, 9.99],
    [5000, 15.99],
    [7000, 15.99],
    [10000, 15.99],
    [15000, 25.99],
    [25000, 25.99],
  ],
  MONDIAL_RELAY_DOMICILE: [
    [250, 4.99],
    [500, 7.49],
    [1000, 9.49],
    [2000, 10.99],
    [3000, 16.39],
    [4000, 16.39],
    [5000, 16.39],
    [7000, 24.99],
    [10000, 24.99],
    [15000, 31.49],
    [25000, 42.99],
  ],
};

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
