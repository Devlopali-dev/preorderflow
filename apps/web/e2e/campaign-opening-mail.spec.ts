import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";
import { hasEmail, readConsoleEmails, waitForEmail } from "./magic-link";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DAY = 24 * 60 * 60 * 1000;

// Quand les commandes s'ouvrent, les personnes intéressées qui ont consenti à être recontactées
// reçoivent un mail pour valider leur commande et payer. Les e-mails sont lus dans les logs de
// l'API (fournisseur « console »).
async function censusCampaign(request: APIRequestContext, token: string) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `MAIL-${stamp}`, name: `Mail ${stamp}`, price: 2 },
    })
  ).json();
  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Campagne mail ${stamp}`,
        slug: `mail-${stamp}`,
        productId: product.id,
        startDate: new Date(Date.now() + 5 * DAY).toISOString(),
      },
    })
  ).json();
  const setStatus = (to: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status: to },
    });
  await setStatus("RECENSEMENT");

  const interest = (suffix: string, quantity: number, consent: boolean) =>
    request.post(`${apiUrl}/api/v1/campaigns/${campaign.id}/interests`, {
      data: {
        email: `ouverture-${suffix}-${stamp}@example.com`,
        firstName: `Prénom${suffix}`,
        lastName: "Test",
        consentToContact: consent,
        items: [{ variantId: product.variants[0].id, quantity }],
      },
    });
  const email = (suffix: string) => `ouverture-${suffix}-${stamp}@example.com`;
  const cleanup = async () => {
    await setStatus("ANNULEE");
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { campaign, setStatus, interest, email, cleanup };
}

test("à l'ouverture des commandes, un mail part aux seuls intéressés qui ont consenti, une seule fois", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const { campaign, setStatus, interest, email, cleanup } = await censusCampaign(request, token);

  // Deux demandes de la même personne (même adresse), une personne qui n'a pas consenti.
  expect((await interest("a", 2, true)).status()).toBe(201);
  expect((await interest("a", 1, true)).status()).toBe(201);
  expect((await interest("b", 4, false)).status()).toBe(201);

  expect((await setStatus("COMMANDES_OUVERTES")).ok()).toBe(true);

  const mail = await waitForEmail(email("a"), `Les commandes sont ouvertes — ${campaign.name}`);
  // Récapitulatif de ce qui avait été demandé (2 + 1 = 3 exemplaires), prénom et lien d'achat.
  expect(mail).toContain("Prénoma");
  expect(mail).toMatch(/3 exemplaire\(s\)/);
  expect(mail).toContain(`/campaigns/${campaign.slug}`);

  // Une seule fois pour une adresse, et rien pour celui qui n'a pas consenti.
  const count = readConsoleEmails().filter(
    (block) =>
      block.trimStart().startsWith(`to=${email("a")} `) &&
      block.includes("Les commandes sont ouvertes"),
  ).length;
  expect(count).toBe(1);
  expect(hasEmail(email("b"), "Les commandes sont ouvertes")).toBe(false);

  await cleanup();
});

test("ouvrir les commandes en repoussant la date de début envoie aussi le mail", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const { campaign, interest, email, cleanup } = await censusCampaign(request, token);
  expect((await interest("c", 1, true)).status()).toBe(201);

  // La date de début arrive (modifiée dans le passé) : l'enregistrement ouvre les commandes.
  const updated = await (
    await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
      headers: auth,
      data: { startDate: new Date(Date.now() - DAY).toISOString() },
    })
  ).json();
  expect(updated.status).toBe("COMMANDES_OUVERTES");

  await waitForEmail(email("c"), `Les commandes sont ouvertes — ${campaign.name}`);
  await cleanup();
});
