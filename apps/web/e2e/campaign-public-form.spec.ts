import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

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

test("la page campagne affiche les photos du produit, la principale en premier", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const { campaign, product, cleanup } = await campaignAt(request, token, "G", "RECENSEMENT");
  // PNG 1×1 : assez pour tester l'affichage sans fichier de fixture.
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  for (const name of ["un.png", "deux.png"]) {
    const res = await request.post(`${apiUrl}/api/v1/products/${product.id}/photo`, {
      headers: authHeader(token),
      multipart: { file: { name, mimeType: "image/png", buffer: tinyPng } },
    });
    expect(res.status()).toBe(201);
  }

  await page.goto(`/campaigns/${campaign.slug}`);
  const photos = page.getByAltText("Photo du produit");
  await expect(photos).toHaveCount(2);
  // La première photo est la principale : affichée en grand, avant les autres.
  await expect(photos.first()).toHaveClass(/aspect-\[4\/3\]/);
  await expect(photos.last()).toHaveClass(/aspect-\[3\/4\]/);

  // Un clic agrandit la photo dans la page (visionneuse interne), sans nouvel onglet.
  let popup = false;
  page.context().on("page", () => {
    popup = true;
  });
  await photos.first().click();
  const viewer = page.getByRole("dialog", { name: "Visionneuse de photos" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("1 / 2")).toBeVisible();
  await viewer.getByRole("button", { name: "Photo suivante" }).click();
  await expect(viewer.getByText("2 / 2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  expect(popup).toBe(false);

  await cleanup();
});

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

  // Transporteur : tous ceux qui couvrent le poids sont proposés, le client choisit la Lettre Verte
  // (premier palier du barème en vigueur : 1,52 € par défaut, ou le tarif La Poste synchronisé).
  const shippingConfig = await (await request.get(`${apiUrl}/api/v1/settings/shipping`)).json();
  const [, lettreVerteRate] = shippingConfig.tariffs.LA_POSTE_VERTE[0] as [number, number];
  await expect(page.getByTestId("carrier-LA_POSTE_SUIVIE")).toBeVisible();
  await expect(page.getByTestId("carrier-MONDIAL_RELAY_POINT")).toBeVisible();
  await page.getByTestId("carrier-LA_POSTE_VERTE").check();
  await expect(page.getByTestId("order-shipping")).toHaveText(`${lettreVerteRate.toFixed(2)} EUR`);

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

  // Confirmation : numéro, montant (articles + port Lettre Verte), lien Revolut du lien de la
  // campagne avec le montant en centimes.
  await expect(page.getByText(/Merci, votre commande/)).toBeVisible();
  const link = page.getByRole("link", { name: "Payer avec Revolut" });
  // 2 × 3 € + frais de port, en centimes.
  const totalCents = Math.round((6 + lettreVerteRate) * 100);
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`revolut\\.me/test-achat.*amount=${totalCents}$`),
  );
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
  expect(detail.carrier).toBe("LA_POSTE_VERTE");
  expect(Number(detail.shippingAmount)).toBe(lettreVerteRate);
  expect(detail.shippingAddress).toMatchObject({ city: "Lyon", address1: "12 rue des Lilas" });
  const after = await (
    await request.get(`${apiUrl}/api/v1/customers/${known.id}`, { headers: auth })
  ).json();
  expect(after.firstName).toBe(known.firstName);
  expect(after.lastName).toBe(known.lastName);
  // Son carnet d'adresses non plus : un client qui en a déjà un n'est jamais modifié par un formulaire public.
  const beforeAddresses = (
    await (await request.get(`${apiUrl}/api/v1/customers/${known.id}`, { headers: auth })).json()
  ).addresses;
  expect(after.addresses).toHaveLength(beforeAddresses.length);
  expect(
    after.addresses.some(
      (address: { address1: string }) => address.address1 === "12 rue des Lilas",
    ),
  ).toBe(false);

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

test("commande publique d'un nouveau client : son adresse remonte dans l'admin", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const { campaign, cleanup } = await campaignAt(request, token, "A", "COMMANDES_OUVERTES");
  const email = `nouveau-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

  await page.goto(`/campaigns/${campaign.slug}`);
  await page.getByLabel("Quelle quantité souhaitez-vous commander ?").fill("1");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Prénom").fill("Nadia");
  await page.getByLabel("Nom", { exact: true }).fill("Nouvelle");
  await page.getByLabel("Adresse", { exact: true }).fill("5 place Bellecour");
  await page.getByLabel("Complément d'adresse (optionnel)").fill("Bâtiment B");
  await page.getByLabel("Code postal").fill("69002");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByRole("button", { name: "Commander" }).click();
  await expect(page.getByText(/Merci, votre commande/)).toBeVisible();

  const customers = await (
    await request.get(`${apiUrl}/api/v1/customers`, { headers: auth })
  ).json();
  const created = customers.find((c: { email: string }) => c.email === email);
  expect(created).toBeTruthy();
  const detail = await (
    await request.get(`${apiUrl}/api/v1/customers/${created.id}`, { headers: auth })
  ).json();
  // Carnet d'adresses : livraison et facturation, avec ce que le client a saisi.
  expect(detail.addresses.map((a: { type: string }) => a.type).sort()).toEqual([
    "BILLING",
    "SHIPPING",
  ]);
  expect(detail.addresses[0]).toMatchObject({
    firstName: "Nadia",
    lastName: "Nouvelle",
    address1: "5 place Bellecour",
    address2: "Bâtiment B",
    postalCode: "69002",
    city: "Lyon",
    country: "FR",
  });

  // Et l'administration l'affiche sur la fiche du client.
  await loginAsAdmin(page, request);
  await page.goto("/customers");
  await page.getByRole("button", { name: "Nadia Nouvelle" }).click();
  // Une ligne par adresse du carnet : facturation et livraison.
  await expect(page.getByRole("dialog").getByText(/5 place Bellecour/)).toHaveCount(2);

  for (const order of detail.orders) {
    await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status: "CANCELLED" },
    });
  }
  await cleanup();
});
