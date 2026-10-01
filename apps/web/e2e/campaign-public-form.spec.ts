import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Campagne dédiée (produit à 3 €, sans couleur) avec son lien de paiement, amenée au statut voulu.
// La route publique de commande est limitée à 5 appels par minute : les tests ci-dessous n'en
// font que deux par passage de la suite.
async function campaignAt(
  request: APIRequestContext,
  token: string,
  label: string,
  status: "RECENSEMENT" | "COMMANDES_OUVERTES" | "COMMANDES_FERMEES",
) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `PUB-${label}-${stamp}`, name: `Public ${label} ${stamp}`, price: 3 },
    })
  ).json();
  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Campagne ${label} ${stamp}`,
        slug: `pub-${label.toLowerCase()}-${stamp}`,
        productId: product.id,
        paymentLink: "https://revolut.me/test-achat?currency=EUR&amount=",
      },
    })
  ).json();
  const setStatus = (to: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status: to },
    });
  const path = ["RECENSEMENT", "COMMANDES_OUVERTES", "COMMANDES_FERMEES"];
  for (const step of path.slice(0, path.indexOf(status) + 1)) await setStatus(step);

  const cleanup = async () => {
    await setStatus("ANNULEE");
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { campaign, product, cleanup };
}

test("recensement : la page garde le formulaire de recensement, sans achat", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const { campaign, cleanup } = await campaignAt(request, token, "R", "RECENSEMENT");

  await page.goto(`/campaigns/${campaign.slug}`);
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commander" })).toHaveCount(0);
  await expect(page.getByText(/Prix indicatif : 3/)).toBeVisible();
  await expect(page.getByText(/ne constitue pas une commande/)).toBeVisible();

  await cleanup();
});

test("commandes ouvertes : formulaire d'achat, commande réelle et lien pour payer", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const { campaign, cleanup } = await campaignAt(request, token, "O", "COMMANDES_OUVERTES");

  // Un client déjà connu : le formulaire anonyme ne doit pas réécrire sa fiche.
  const customers = await (
    await request.get(`${apiUrl}/api/v1/customers`, { headers: auth })
  ).json();
  const known = customers.find((c: { email: string }) => c.email === "client6@example.com");

  await page.goto(`/campaigns/${campaign.slug}`);
  // Mode achat : plus de recensement, prix non indicatif, bouton Commander.
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toHaveCount(0);
  await expect(page.getByText(/ne constitue pas une commande/)).toHaveCount(0);
  await expect(page.getByText(/^Prix : 3/)).toBeVisible();

  await page.getByLabel("Quelle quantité souhaitez-vous commander ?").fill("2");
  await expect(page.getByTestId("order-subtotal")).toHaveText("6.00");

  // Validation côté formulaire : rien n'est envoyé tant que l'adresse manque.
  await page.getByLabel("Email", { exact: true }).fill("client6@example.com");
  await page.getByLabel("Prénom").fill("Autre");
  await page.getByLabel("Nom", { exact: true }).fill("Nom Modifié");
  await page.getByRole("button", { name: "Commander" }).click();
  await expect(page.getByText("Adresse requise")).toBeVisible();

  await page.getByLabel("Adresse", { exact: true }).fill("12 rue des Lilas");
  await page.getByLabel("Code postal").fill("69001");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByRole("button", { name: "Commander" }).click();

  // Confirmation : numéro, montant, lien Revolut du lien de la campagne avec le montant en centimes.
  await expect(page.getByText(/Merci, votre commande/)).toBeVisible();
  const link = page.getByRole("link", { name: "Payer avec Revolut" });
  await expect(link).toHaveAttribute("href", /revolut\.me\/test-achat.*amount=600$/);
  await expect(page.getByAltText("QR code de paiement")).toBeVisible();
  await expect(page.getByText(/nom et prénom/)).toBeVisible();
  await expect(page.getByText(/remarque/)).toBeVisible();

  // Côté admin : commande rattachée à la campagne, en attente de paiement, règlement manuel,
  // et la fiche du client connu n'a pas été réécrite.
  const orders = await (await request.get(`${apiUrl}/api/v1/orders`, { headers: auth })).json();
  const order = orders.find((o: { campaignId: string }) => o.campaignId === campaign.id);
  expect(order).toBeTruthy();
  expect(order.status).toBe("PENDING_PAYMENT");
  const detail = await (
    await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })
  ).json();
  expect(detail.payments).toHaveLength(1);
  expect(detail.payments[0]).toMatchObject({ provider: "MANUAL", status: "PENDING" });
  expect(detail.shippingAddress).toMatchObject({ city: "Lyon", address1: "12 rue des Lilas" });
  const after = await (
    await request.get(`${apiUrl}/api/v1/customers/${known.id}`, { headers: auth })
  ).json();
  expect(after.firstName).toBe(known.firstName);
  expect(after.lastName).toBe(known.lastName);

  await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
    headers: auth,
    data: { status: "CANCELLED" },
  });
  await cleanup();
});

test("commandes fermées : plus de formulaire, un message", async ({ page, request }) => {
  const token = await getAdminToken(request);
  const { campaign, cleanup } = await campaignAt(request, token, "F", "COMMANDES_FERMEES");

  await page.goto(`/campaigns/${campaign.slug}`);
  await expect(page.getByText("Les commandes de cette campagne sont fermées.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Commander" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toHaveCount(0);

  await cleanup();
});

test("l'API refuse une commande publique tant que les commandes ne sont pas ouvertes", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const { campaign, product, cleanup } = await campaignAt(request, token, "X", "RECENSEMENT");
  const full = await (
    await request.get(`${apiUrl}/api/v1/products/${product.id}`, { headers: auth })
  ).json();

  const res = await request.post(`${apiUrl}/api/v1/campaigns/${campaign.id}/orders`, {
    data: {
      email: "refus@example.com",
      firstName: "Refus",
      lastName: "Test",
      items: [{ variantId: full.variants[0].id, quantity: 1 }],
      shippingAddress: { address1: "1 rue", postalCode: "75000", city: "Paris", country: "FR" },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).message).toMatch(/pas ouvertes/);

  await cleanup();
});
