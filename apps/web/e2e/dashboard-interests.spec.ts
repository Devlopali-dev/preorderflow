import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Le compteur est global : un recensement créé en parallèle par un autre spec
// fausse un delta. Le test recrée ses propres données, il peut donc être rejoué.
test.describe.configure({ retries: 2 });

type Overview = { totalInterests: number; interestPeople: number; interestQuantity: number };

async function overview(request: APIRequestContext, token: string): Promise<Overview> {
  return (await request.get(`${apiUrl}/api/v1/dashboard`, { headers: authHeader(token) })).json();
}

// Campagne en recensement, avec son propre produit.
async function openCampaign(request: APIRequestContext, token: string, label: string) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `${label}-${stamp}`, name: `${label} ${stamp}`, price: 1 },
    })
  ).json();
  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Campagne ${label} ${stamp}`,
        slug: `${label.toLowerCase()}-${stamp}`,
        productId: product.id,
      },
    })
  ).json();
  const setStatus = (status: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status },
    });
  expect((await setStatus("RECENSEMENT")).ok()).toBe(true);

  const interest = (suffix: string, quantity: number) =>
    request.post(`${apiUrl}/api/v1/campaigns/${campaign.id}/interests`, {
      data: {
        email: `dash-${label.toLowerCase()}-${stamp}-${suffix}@example.com`,
        firstName: "Dash",
        lastName: suffix,
        consentToContact: true,
        items: [{ variantId: product.variants[0].id, quantity }],
      },
    });
  const archiveProduct = () =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });

  return { setStatus, interest, archiveProduct };
}

test("le compteur de recensement ne compte que les campagnes actives, en demandes, personnes et exemplaires", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const before = await overview(request, token);

  const active = await openCampaign(request, token, "DASH-A");
  expect((await active.interest("a", 2)).status()).toBe(201);
  expect((await active.interest("b", 3)).status()).toBe(201);

  const other = await openCampaign(request, token, "DASH-B");
  expect((await other.interest("c", 4)).status()).toBe(201);

  // Deux campagnes actives : 3 demandes, 3 personnes, 9 exemplaires.
  const both = await overview(request, token);
  expect(both.totalInterests - before.totalInterests).toBe(3);
  expect(both.interestPeople - before.interestPeople).toBe(3);
  expect(both.interestQuantity - before.interestQuantity).toBe(9);

  // Une fois archivée, la campagne n'entre plus dans le compteur.
  expect((await other.setStatus("ANNULEE")).ok()).toBe(true);
  const afterArchive = await overview(request, token);
  expect(afterArchive.totalInterests - before.totalInterests).toBe(2);
  expect(afterArchive.interestPeople - before.interestPeople).toBe(2);
  expect(afterArchive.interestQuantity - before.interestQuantity).toBe(5);

  await active.setStatus("ANNULEE");
  await active.archiveProduct();
  await other.archiveProduct();
});

test("la carte du dashboard affiche personnes et exemplaires sous le nombre de demandes", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page, request);

  await page.goto("/dashboard");
  const card = page.getByRole("link", { name: /Demandes de recensement/ });
  await expect(card).toContainText(/\d+ personnes? · \d+ exemplaires?/);
});
