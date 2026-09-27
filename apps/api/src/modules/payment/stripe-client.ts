import Stripe from "stripe";

// Jamais instancié à froid (pas au chargement du module) : Stripe reste une
// dépendance optionnelle du cœur (CLAUDE.md §32/§11) — l'admin choisit le
// mode de paiement par commande (manuel/virement/Revolut/Stripe), rien
// n'échoue au démarrage si STRIPE_SECRET_KEY n'est pas configurée.
let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurée — le paiement par carte n'est pas disponible.");
  }
  client ??= new Stripe(key);
  return client;
}
