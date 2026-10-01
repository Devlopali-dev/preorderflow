import { prisma } from "@preorderflow/database";

// Carnet d'adresses d'un client (entité Address), celui que l'administration affiche. Les
// adresses saisies côté client (formulaire d'achat public, profil) y sont enregistrées pour
// remonter dans l'admin ; la commande, elle, garde son propre instantané figé.

export interface AddressSource {
  firstName: string;
  lastName: string;
  phone?: string | null;
  company?: string | null;
  address1: string;
  address2?: string | null;
  postalCode: string;
  city: string;
  country: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Les champs d'une ligne du carnet, à partir d'une saisie.
export function addressRow(
  customerId: string,
  type: "BILLING" | "SHIPPING",
  source: AddressSource,
) {
  return {
    customerId,
    type,
    firstName: source.firstName.trim(),
    lastName: source.lastName.trim(),
    company: clean(source.company),
    address1: source.address1.trim(),
    address2: clean(source.address2),
    postalCode: source.postalCode.trim(),
    city: source.city.trim(),
    country: source.country.trim().toUpperCase(),
    phone: clean(source.phone),
  };
}

// Commande anonyme : n'enregistre l'adresse que si le client n'en a encore aucune. Un client
// existant qui a déjà un carnet n'est jamais modifié par un formulaire public (n'importe qui
// peut saisir son email) ; l'adresse de la commande suffit pour cette livraison.
export async function saveAddressIfNone(
  customerId: string,
  source: AddressSource,
): Promise<boolean> {
  if ((await prisma.address.count({ where: { customerId } })) > 0) return false;
  await prisma.address.createMany({
    data: [addressRow(customerId, "BILLING", source), addressRow(customerId, "SHIPPING", source)],
  });
  return true;
}

// Profil du client connecté : met à jour son adresse de livraison (la crée au besoin) et, s'il n'a
// pas d'adresse de facturation, en crée une identique.
export async function saveShippingAddress(
  customerId: string,
  source: AddressSource,
): Promise<void> {
  const existing = await prisma.address.findMany({ where: { customerId } });
  const shipping = existing.find((a) => a.type === "SHIPPING");
  if (shipping) {
    const {
      customerId: _ignored,
      type: _type,
      ...data
    } = addressRow(customerId, "SHIPPING", source);
    await prisma.address.update({ where: { id: shipping.id }, data });
  } else {
    await prisma.address.create({ data: addressRow(customerId, "SHIPPING", source) });
  }
  if (!existing.some((a) => a.type === "BILLING")) {
    await prisma.address.create({ data: addressRow(customerId, "BILLING", source) });
  }
}
