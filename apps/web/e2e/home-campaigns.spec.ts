import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DAY = 24 * 60 * 60 * 1000;

// PNG 1×1 : assez pour tester l'envoi d'une image sans fichier de fixture.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function campaign(
  request: APIRequestContext,
  token: string,
  label: string,
  status: "DRAFT" | "RECENSEMENT" | "COMMANDES_OUVERTES",
  withImage: boolean,
) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `HOME-${label}-${stamp}`, name: `Accueil ${label} ${stamp}`, price: 2 },
    })
  ).json();
  const created = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Accueil ${label} ${stamp}`,
        slug: `accueil-${label.toLowerCase()}-${stamp}`,
        description: `Description ${label}`,
        productId: product.id,
        // Début à venir : le statut reste celui qu'on choisit, sans passage automatique.
        startDate: new Date(Date.now() + 10 * DAY).toISOString(),
      },
    })
  ).json();
  const setStatus = (to: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${created.id}/status`, {
      headers: auth,
      data: { status: to },
    });
  if (status !== "DRAFT") await setStatus("RECENSEMENT");
  if (status === "COMMANDES_OUVERTES") await setStatus("COMMANDES_OUVERTES");
  if (withImage) {
    await request.post(`${apiUrl}/api/v1/campaigns/${created.id}/photo`, {
      headers: auth,
      multipart: { file: { name: "apercu.png", mimeType: "image/png", buffer: TINY_PNG } },
    });
  }
  const cleanup = async () => {
    await setStatus("ANNULEE");
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { created, cleanup };
}

test("l'accueil sépare les commandes ouvertes et le recensement, en cards avec l'image de la campagne", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const open = await campaign(request, token, "Ouverte", "COMMANDES_OUVERTES", false);
  const census = await campaign(request, token, "Recensee", "RECENSEMENT", true);
  const draft = await campaign(request, token, "Brouillon", "DRAFT", true);

  await page.goto("/");
  const openSection = page.getByRole("region", { name: "Commandes ouvertes" });
  const censusSection = page.getByRole("region", { name: "Recensement" });
  await expect(openSection).toBeVisible();
  await expect(censusSection).toBeVisible();

  // Chaque campagne est dans sa section, jamais dans l'autre ; le brouillon n'apparaît pas.
  await expect(openSection.getByRole("heading", { name: open.created.name })).toBeVisible();
  await expect(censusSection.getByRole("heading", { name: open.created.name })).toHaveCount(0);
  await expect(censusSection.getByRole("heading", { name: census.created.name })).toBeVisible();
  await expect(openSection.getByRole("heading", { name: census.created.name })).toHaveCount(0);
  await expect(page.getByText(draft.created.name)).toHaveCount(0);

  // Les commandes ouvertes passent avant le recensement.
  const openBox = await openSection.boundingBox();
  const censusBox = await censusSection.boundingBox();
  expect(openBox!.y).toBeLessThan(censusBox!.y);

  // Une campagne avec image : card avec cet aperçu. Sans image : un cadre neutre, pas d'<img>.
  const censusCard = censusSection.getByRole("link").filter({ hasText: census.created.name });
  await expect(censusCard.getByRole("img", { name: /Aperçu de la campagne/ })).toBeVisible();
  const src = await censusCard.getByRole("img").getAttribute("src");
  expect(src).toMatch(/\/uploads\/campaigns\//);
  const openCard = openSection.getByRole("link").filter({ hasText: open.created.name });
  await expect(openCard.getByRole("img")).toHaveCount(0);
  await expect(openCard.getByText("Pas d'aperçu")).toBeVisible();

  // La card mène à la page de la campagne.
  await openCard.click();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${open.created.slug}$`));
  await expect(page.getByRole("button", { name: "Commander" })).toBeVisible();

  for (const c of [open, census, draft]) await c.cleanup();
});
