import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Address {
  id: string;
  type: string;
  company: string | null;
  address2: string | null;
  phone: string | null;
  city: string;
}

const billing = {
  type: "BILLING",
  firstName: "Camille",
  lastName: "Martin",
  company: "Atelier Martin",
  address1: "12 rue des Lilas",
  address2: "Bâtiment B",
  postalCode: "69001",
  city: "Lyon",
  country: "FR",
  phone: "0601020304",
};
const shipping = {
  type: "SHIPPING",
  firstName: "Camille",
  lastName: "Martin",
  address1: "3 place du Marché",
  postalCode: "13001",
  city: "Marseille",
  country: "FR",
};

// Clients dédiés, anonymisés à la fin (on ne supprime pas un client).
async function setup(request: APIRequestContext) {
  const auth = authHeader(await getAdminToken(request));
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const created: string[] = [];

  const create = async (data: Record<string, unknown>) => {
    const res = await request.post(`${apiUrl}/api/v1/customers`, { headers: auth, data });
    // Le corps d'une APIResponse Playwright se relit autant de fois que voulu.
    if (res.ok()) created.push((await res.json()).id);
    return res;
  };
  const get = async (id: string) =>
    (await request.get(`${apiUrl}/api/v1/customers/${id}`, { headers: auth })).json();
  const patch = (id: string, data: Record<string, unknown>) =>
    request.patch(`${apiUrl}/api/v1/customers/${id}`, { headers: auth, data });
  const cleanup = async () => {
    for (const id of created) {
      await request.post(`${apiUrl}/api/v1/customers/${id}/gdpr-anonymize`, { headers: auth });
    }
  };
  return { auth, stamp, create, get, patch, cleanup };
}

test("un client se crée avec toutes ses informations, adresses comprises", async ({ request }) => {
  const { stamp, create, get, cleanup } = await setup(request);

  const res = await create({
    email: `client-complet-${stamp}@example.com`,
    firstName: "Camille",
    lastName: "Martin",
    phone: "0601020304",
    addresses: [billing, shipping],
  });
  expect(res.status()).toBe(201);
  const customer = await get((await res.json()).id);

  expect(customer.phone).toBe("0601020304");
  expect(customer.addresses).toHaveLength(2);
  const facturation = customer.addresses.find((a: Address) => a.type === "BILLING");
  expect(facturation.company).toBe("Atelier Martin");
  expect(facturation.address2).toBe("Bâtiment B");
  expect(facturation.phone).toBe("0601020304");
  // Un champ optionnel absent est stocké à null.
  const livraison = customer.addresses.find((a: Address) => a.type === "SHIPPING");
  expect(livraison.company).toBeNull();
  expect(livraison.address2).toBeNull();

  await cleanup();
});

test("modifier un client met à jour toutes ses informations et synchronise ses adresses", async ({
  request,
}) => {
  const { stamp, create, get, patch, cleanup } = await setup(request);
  const id = (
    await (
      await create({
        email: `client-modif-${stamp}@example.com`,
        firstName: "Camille",
        lastName: "Martin",
        addresses: [billing, shipping],
      })
    ).json()
  ).id;
  const before = await get(id);
  const billingId = before.addresses.find((a: Address) => a.type === "BILLING").id;

  // Tout change : email, identité, téléphone. Adresse existante mise à jour,
  // l'autre retirée (absente de la liste), une nouvelle ajoutée.
  const newEmail = `client-modif-2-${stamp}@example.com`;
  const res = await patch(id, {
    email: newEmail,
    firstName: "Camila",
    lastName: "Martins",
    phone: "0700000000",
    addresses: [
      { ...billing, id: billingId, city: "Villeurbanne", company: "" },
      { ...shipping, city: "Nice", postalCode: "06000" },
    ],
  });
  expect(res.status()).toBe(200);

  const after = await get(id);
  expect(after.email).toBe(newEmail);
  expect(after.firstName).toBe("Camila");
  expect(after.lastName).toBe("Martins");
  expect(after.phone).toBe("0700000000");
  expect(after.addresses).toHaveLength(2);
  const updated = after.addresses.find((a: Address) => a.id === billingId);
  expect(updated.city).toBe("Villeurbanne");
  expect(updated.company).toBeNull(); // chaîne vide -> null
  expect(after.addresses.some((a: Address) => a.city === "Nice")).toBe(true);
  expect(after.addresses.some((a: Address) => a.city === "Marseille")).toBe(false);

  // Sans `addresses`, le carnet ne bouge pas.
  await patch(id, { firstName: "Camille" });
  expect((await get(id)).addresses).toHaveLength(2);

  // Avec une liste vide, il est vidé.
  await patch(id, { addresses: [] });
  expect((await get(id)).addresses).toHaveLength(0);

  await cleanup();
});

test("les garde-fous : email pris, adresse d'un autre client, données invalides", async ({
  request,
}) => {
  const { stamp, create, get, patch, cleanup } = await setup(request);
  const first = await (
    await create({ email: `garde-a-${stamp}@example.com`, firstName: "A", lastName: "A" })
  ).json();
  const second = await (
    await create({
      email: `garde-b-${stamp}@example.com`,
      firstName: "B",
      lastName: "B",
      addresses: [shipping],
    })
  ).json();

  // Email déjà pris (création et modification).
  expect(
    (
      await create({ email: `garde-a-${stamp}@example.com`, firstName: "X", lastName: "X" })
    ).status(),
  ).toBe(400);
  expect((await patch(second.id, { email: `garde-a-${stamp}@example.com` })).status()).toBe(400);

  // Une adresse qui appartient à un autre client ne se réutilise pas.
  const foreignId = (await get(second.id)).addresses[0].id;
  expect((await patch(first.id, { addresses: [{ ...shipping, id: foreignId }] })).status()).toBe(
    400,
  );
  expect((await get(second.id)).addresses).toHaveLength(1);

  // Données invalides : type inconnu, champ obligatoire manquant.
  expect((await patch(first.id, { addresses: [{ ...shipping, type: "AUTRE" }] })).status()).toBe(
    400,
  );
  expect((await patch(first.id, { addresses: [{ ...shipping, city: "" }] })).status()).toBe(400);
  expect((await patch(first.id, { email: "pas-un-email" })).status()).toBe(400);

  await cleanup();
});

test("l'audit ne garde pas les données personnelles, et un client anonymisé n'est plus modifiable", async ({
  request,
}) => {
  const { auth, stamp, create, patch } = await setup(request);
  const customer = await (
    await create({ email: `audit-${stamp}@example.com`, firstName: "Audit", lastName: "Test" })
  ).json();

  const lastName = `Confidentiel${stamp}`.replace("-", "");
  await patch(customer.id, { lastName, addresses: [shipping] });

  const logs = await (await request.get(`${apiUrl}/api/v1/audit-logs`, { headers: auth })).json();
  const entry = logs.find(
    (log: { action: string; entityId: string }) =>
      log.action === "CUSTOMER_UPDATED" && log.entityId === customer.id,
  );
  expect(entry.metadata.fieldsChanged).toEqual(expect.arrayContaining(["lastName", "addresses"]));
  expect(JSON.stringify(entry.metadata)).not.toContain(lastName);
  expect(JSON.stringify(entry.metadata)).not.toContain("Marseille");

  await request.post(`${apiUrl}/api/v1/customers/${customer.id}/gdpr-anonymize`, {
    headers: auth,
  });
  const afterAnonymize = await patch(customer.id, { firstName: "Nouveau" });
  expect(afterAnonymize.status()).toBe(400);
  expect((await afterAnonymize.json()).message).toMatch(/anonymisé/);
});
