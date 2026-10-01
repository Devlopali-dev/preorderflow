import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Produit et campagne dédiés : rien ici ne dépend des données du seed.
async function setup(request: APIRequestContext, label: string) {
  const auth = authHeader(await getAdminToken(request));
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
  const registerInterest = () =>
    request.post(`${apiUrl}/api/v1/campaigns/${campaign.id}/interests`, {
      data: {
        email: `archives-${stamp}@example.com`,
        firstName: "Archive",
        lastName: "Test",
        consentToContact: true,
        items: [{ variantId: product.variants[0].id, quantity: 2 }],
      },
    });
  const auditActions = async (action: string) =>
    (await (await request.get(`${apiUrl}/api/v1/audit-logs`, { headers: auth })).json()).filter(
      (entry: { action: string; entityId: string }) =>
        entry.action === action && entry.entityId === campaign.id,
    );
  const archiveProduct = () =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });

  return { auth, campaign, setStatus, registerInterest, auditActions, archiveProduct };
}

test("une campagne archivée est en lecture seule et peut être réactivée", async ({ request }) => {
  const { auth, campaign, setStatus, registerInterest, auditActions, archiveProduct } = await setup(
    request,
    "ARC-A",
  );

  expect((await setStatus("RECENSEMENT")).ok()).toBe(true);
  expect((await registerInterest()).status()).toBe(201);
  expect((await setStatus("ANNULEE")).ok()).toBe(true);

  // Archivée : plus de modification, plus de recensement.
  const edit = await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
    data: { name: "Renommée" },
  });
  expect(edit.status()).toBe(400);
  expect((await edit.json()).message).toMatch(/archivée/);
  expect((await registerInterest()).status()).toBe(400);

  // Réactivation : seulement vers le brouillon, tracée dans l'audit.
  const jump = await setStatus("RECENSEMENT");
  expect(jump.status()).toBe(400);
  const reactivated = await setStatus("DRAFT");
  expect(reactivated.ok()).toBe(true);
  expect((await reactivated.json()).status).toBe("DRAFT");
  expect(await auditActions("CAMPAIGN_REACTIVATED")).toHaveLength(1);

  // Modifiable de nouveau.
  const renamed = await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
    data: { name: "Renommée" },
  });
  expect(renamed.ok()).toBe(true);

  await setStatus("ANNULEE");
  await archiveProduct();
});

test("une campagne archivée se supprime définitivement, avec ses demandes de recensement", async ({
  request,
}) => {
  const { auth, campaign, setStatus, registerInterest, auditActions, archiveProduct } = await setup(
    request,
    "ARC-B",
  );

  await setStatus("RECENSEMENT");
  expect((await registerInterest()).status()).toBe(201);

  // En cours avec des demandes : la suppression reste refusée.
  const refused = await request.delete(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
  });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).message).toMatch(/Annulez/);

  // Archivée : suppression définitive, demandes comprises.
  await setStatus("ANNULEE");
  const removed = await request.delete(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
  });
  expect(removed.status()).toBe(200);

  expect((await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}`)).status()).toBe(404);
  const audit = await auditActions("CAMPAIGN_DELETED");
  expect(audit).toHaveLength(1);
  expect(audit[0].metadata.deletedInterests).toBe(1);

  await archiveProduct();
});

test("une campagne sans demande se supprime, mais pas par un opérateur", async ({ request }) => {
  const { auth, campaign, archiveProduct } = await setup(request, "ARC-C");

  const login = await request.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: "operateur1@preorderflow.dev", password: "password123" },
  });
  const { accessToken } = await login.json();
  const forbidden = await request.delete(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: authHeader(accessToken),
  });
  expect(forbidden.status()).toBe(403);

  const removed = await request.delete(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
    headers: auth,
  });
  expect(removed.status()).toBe(200);

  await archiveProduct();
});
