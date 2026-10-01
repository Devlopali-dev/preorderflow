import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Une campagne en brouillon est invisible du public : introuvable (404) pour un visiteur, visible
// seulement d'un administrateur connecté (aperçu). Dès le recensement, elle devient publique.
async function draftCampaign(request: import("@playwright/test").APIRequestContext, token: string) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `BRO-${stamp}`, name: `Brouillon ${stamp}`, price: 2 },
    })
  ).json();
  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Campagne brouillon ${stamp}`,
        slug: `brouillon-${stamp}`,
        productId: product.id,
      },
    })
  ).json();
  const publish = () =>
    request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status: "RECENSEMENT" },
    });
  const cleanup = async () => {
    await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status: "ANNULEE" },
    });
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { campaign, publish, cleanup };
}

test("l'API cache un brouillon au public, pas à un administrateur, et il devient public au recensement", async ({
  request,
  playwright,
}) => {
  const token = await getAdminToken(request);
  const { campaign, publish, cleanup } = await draftCampaign(request, token);
  // Contexte sans aucun jeton : un visiteur anonyme.
  const anonymous = await playwright.request.newContext();

  // Visiteur : fiche, statistiques et liste ne montrent pas le brouillon ; 404, jamais 403.
  expect((await anonymous.get(`${apiUrl}/api/v1/campaigns/${campaign.slug}`)).status()).toBe(404);
  expect(
    (await anonymous.get(`${apiUrl}/api/v1/campaigns/${campaign.id}/statistics`)).status(),
  ).toBe(404);
  const publicList = await (await anonymous.get(`${apiUrl}/api/v1/campaigns`)).json();
  expect(publicList.some((c: { id: string }) => c.id === campaign.id)).toBe(false);

  // Administrateur : il le voit partout.
  const adminRead = await request.get(`${apiUrl}/api/v1/campaigns/${campaign.slug}`, {
    headers: authHeader(token),
  });
  expect(adminRead.status()).toBe(200);
  const adminList = await (
    await request.get(`${apiUrl}/api/v1/campaigns`, { headers: authHeader(token) })
  ).json();
  expect(adminList.some((c: { id: string }) => c.id === campaign.id)).toBe(true);

  // Un jeton invalide reste simplement anonyme (jamais une erreur sur une route publique).
  const garbage = await anonymous.get(`${apiUrl}/api/v1/campaigns/${campaign.slug}`, {
    headers: { Authorization: "Bearer nimporte.quoi.jeton" },
  });
  expect(garbage.status()).toBe(404);

  // Le recensement public d'un brouillon est refusé.
  const interest = await anonymous.post(`${apiUrl}/api/v1/campaigns/${campaign.id}/interests`, {
    data: {
      email: "brouillon@example.com",
      firstName: "Visiteur",
      lastName: "Test",
      consentToContact: true,
      items: [{ variantId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
    },
  });
  expect(interest.status()).toBe(404);

  // Publiée (recensement) : visible de tous.
  await publish();
  expect((await anonymous.get(`${apiUrl}/api/v1/campaigns/${campaign.slug}`)).status()).toBe(200);
  const afterList = await (await anonymous.get(`${apiUrl}/api/v1/campaigns`)).json();
  expect(afterList.some((c: { id: string }) => c.id === campaign.id)).toBe(true);

  await anonymous.dispose();
  await cleanup();
});

test("la page publique d'un brouillon est une 404 pour un visiteur, un aperçu pour un administrateur", async ({
  page,
  browser,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const { campaign, cleanup } = await draftCampaign(request, token);

  // Visiteur : contexte de navigation sans cookie.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  const response = await visitorPage.goto(`/campaigns/${campaign.slug}`);
  expect(response?.status()).toBe(404);
  await visitor.close();

  // Administrateur connecté : aperçu, sans formulaire.
  const preview = await page.goto(`/campaigns/${campaign.slug}`);
  expect(preview?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: campaign.name })).toBeVisible();
  await expect(page.getByText(/Aperçu administrateur/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Commander" })).toHaveCount(0);

  // L'accueil public ne liste pas le brouillon.
  await page.goto("/");
  await expect(page.getByText(campaign.name)).toHaveCount(0);

  await cleanup();
});
