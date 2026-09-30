// Référence automatique d'un lot de production : `nom-AAAAMMJJ`, avec un
// suffixe `#1`, `#2`… quand la même référence existe déjà (plusieurs lots du
// même produit le même jour).

import { slugifyName } from "../../common/slug";

// Date en UTC (la base est en UTC), au format AAAAMMJJ.
export function formatDateStamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function productionReferenceBase(productName: string, date: Date): string {
  const slug = slugifyName(productName) || "lot";
  return `${slug}-${formatDateStamp(date)}`;
}

// Première référence libre : `base`, puis `base#1`, `base#2`…
export function nextAvailableReference(base: string, existingReferences: string[]): string {
  const taken = new Set(existingReferences);
  if (!taken.has(base)) return base;
  let suffix = 1;
  while (taken.has(`${base}#${suffix}`)) suffix += 1;
  return `${base}#${suffix}`;
}
