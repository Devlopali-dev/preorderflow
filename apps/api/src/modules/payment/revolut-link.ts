// Pas d'intégration API Revolut : on construit un lien de paiement à partir
// d'un lien Revolut.me configuré (REVOLUT_PAYMENT_LINK dans le .env, ou lien
// de la campagne), avec la devise et le montant en CENTIMES en paramètres :
// https://revolut.me/<pseudo>?currency=EUR&amount=300 pour 3 €.
// Le QR code est généré côté frontend à partir de ce lien, à l'affichage.

export function buildRevolutPaymentLink(
  baseLink: string,
  amount: number,
  currency = "EUR",
): string {
  let url: URL;
  try {
    url = new URL(baseLink.trim());
  } catch {
    return baseLink.trim();
  }
  // Seuls les liens Revolut.me acceptent un montant : tout autre lien est
  // renvoyé tel quel (page de paiement externe, montant à saisir par le payeur).
  if (url.hostname !== "revolut.me") {
    return url.toString();
  }
  // Un montant déjà présent (ex : `...&amount=` du .env) est remplacé.
  if (!url.searchParams.get("currency")) {
    url.searchParams.set("currency", currency);
  }
  url.searchParams.set("amount", String(Math.round(amount * 100)));
  return url.toString();
}
