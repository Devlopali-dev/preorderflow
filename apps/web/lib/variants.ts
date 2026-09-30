// Libellé d'une variante : « Sifflet — Rouge », ou juste « Sifflet » pour la
// variante par défaut d'un produit sans couleur. Fichier séparé de lib/api.ts
// (qui importe next/headers) pour rester importable depuis les composants client.
export function variantLabel(
  productName: string,
  color: { name: string } | null | undefined,
): string {
  return color ? `${productName} — ${color.name}` : productName;
}
