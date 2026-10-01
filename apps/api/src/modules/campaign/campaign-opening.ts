// Mail « les commandes sont ouvertes » : une adresse reçoit un seul message, même si la personne a
// fait plusieurs demandes de recensement, avec le récapitulatif de ce qu'elle avait demandé.

export interface InterestForMail {
  email: string;
  firstName: string;
  items: Array<{ quantity: number; variant: { color: { name: string } | null } }>;
}

export interface OpeningRecipient {
  email: string;
  firstName: string;
  quantity: number;
  // « (2 × Rouge, 1 × Bleu) », vide quand le produit n'a pas de couleur.
  details: string;
}

export function groupInterestsByEmail(interests: InterestForMail[]): OpeningRecipient[] {
  const byEmail = new Map<
    string,
    {
      email: string;
      firstName: string;
      quantity: number;
      colors: Map<string, number>;
      hasColors: boolean;
    }
  >();

  for (const interest of interests) {
    const key = interest.email.trim().toLowerCase();
    if (!key) continue;
    let entry = byEmail.get(key);
    if (!entry) {
      entry = {
        email: interest.email.trim(),
        firstName: interest.firstName,
        quantity: 0,
        colors: new Map(),
        hasColors: false,
      };
      byEmail.set(key, entry);
    }
    for (const item of interest.items) {
      entry.quantity += item.quantity;
      const label = item.variant.color?.name ?? "Standard";
      entry.hasColors ||= Boolean(item.variant.color);
      entry.colors.set(label, (entry.colors.get(label) ?? 0) + item.quantity);
    }
  }

  return [...byEmail.values()].map((entry) => ({
    email: entry.email,
    firstName: entry.firstName,
    quantity: entry.quantity,
    details: entry.hasColors
      ? ` (${[...entry.colors].map(([name, quantity]) => `${quantity} × ${name}`).join(", ")})`
      : "",
  }));
}

export function campaignPublicUrl(
  slug: string,
  webUrl = process.env.WEB_URL ?? "http://localhost:3000",
): string {
  return `${webUrl.replace(/\/+$/, "")}/campaigns/${slug}`;
}
