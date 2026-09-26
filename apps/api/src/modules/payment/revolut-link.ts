// Pas d'intégration API Revolut : on construit un lien de paiement à
// partir d'un lien Revolut.me configuré (REVOLUT_PAYMENT_LINK), avec le
// montant ajouté dans le chemin (format supporté par revolut.me/<user>/<montant>).
// Le QR code est généré côté frontend à partir de ce lien, à l'affichage.

export function buildRevolutPaymentLink(baseLink: string, amount: number): string {
  const trimmed = baseLink.replace(/\/+$/, "");
  return `${trimmed}/${amount.toFixed(2)}`;
}
