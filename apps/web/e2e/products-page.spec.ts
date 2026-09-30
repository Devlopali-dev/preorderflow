import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// PNG 1×1 : assez pour tester l'envoi d'image sans fichier de fixture.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("un produit créé avec photo et couleurs, puis archivé, passe dans les archivés repliés", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const sku = `UI-${stamp}`;
  const name = `Produit UI ${stamp}`;

  // Deux couleurs actives de la palette, quelles qu'elles soient.
  const [first, second] = (
    await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json()
  ).filter((c: { active: boolean }) => c.active) as Array<{ name: string }>;

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Nouveau produit" }).click();

  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Prix").fill("9.90");
  await page.getByLabel("Photo (optionnel)").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // Les couleurs n'apparaissent que si le produit a des variantes.
  await expect(page.getByRole("checkbox", { name: first.name, exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Ce produit a des variantes" }).check();
  await page.getByRole("checkbox", { name: first.name, exact: true }).check();
  await page.getByRole("checkbox", { name: second.name, exact: true }).check();

  // Plus de champ lien ni PDF : la photo se téléverse, le PDF n'existe pas.
  await expect(page.getByLabel("URL de la photo")).toHaveCount(0);
  await expect(page.getByLabel("URL du PDF de présentation")).toHaveCount(0);

  await page.getByRole("button", { name: "Créer", exact: true }).click();
  // La modale ne se ferme qu'après le produit, la photo et les variantes. On
  // attend son champ SKU plutôt que le bouton, dont le libellé change pendant
  // l'enregistrement (état de chargement).
  await expect(page.getByLabel("SKU")).toHaveCount(0);

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === sku);
  expect(product.imageUrl).toMatch(/^\/uploads\/products\//);
  expect(
    product.variants.map((v: { color: { name: string } | null }) => v.color?.name).sort(),
  ).toEqual([first.name, second.name].sort());

  // Actif : dans le tableau principal, pas dans les archivés.
  await page.reload();
  await expect(page.getByText(name)).toBeVisible();

  const archived = await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, {
    headers: auth,
  });
  expect(archived.ok()).toBe(true);

  // Archivé : replié par défaut, visible une fois la section ouverte.
  await page.reload();
  await expect(page.getByText(name)).toHaveCount(0);
  await page.getByRole("button", { name: /Archivés/ }).click();
  await expect(page.getByText(name)).toBeVisible();
});

// Couleur temporaire créée puis supprimée par le test : on ne touche pas aux
// couleurs partagées du seed, que d'autres specs utilisent en parallèle.
test("une couleur inactive est en italique avec un badge d'avertissement", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const name = `Inactive-${Date.now()}`;

  const created = await (
    await request.post(`${apiUrl}/api/v1/colors`, { headers: auth, data: { name, hex: "#654321" } })
  ).json();
  await request.patch(`${apiUrl}/api/v1/colors/${created.id}`, {
    headers: auth,
    data: { active: false },
  });

  try {
    await page.goto("/settings");
    await page.getByRole("button", { name: /Couleurs/ }).click();
    const row = page.locator("li", { hasText: name });
    await expect(row.locator("span.italic", { hasText: name })).toBeVisible();
    await expect(row.locator(".badge-warning", { hasText: "inactive" })).toBeVisible();
  } finally {
    await request.delete(`${apiUrl}/api/v1/colors/${created.id}`, { headers: auth });
  }
});

test("la palette de base pré-remplit la couleur et une couleur créée peut être supprimée", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);

  // État de départ propre si un run précédent a été interrompu.
  const colors = await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json();
  const leftover = colors.find((c: { name: string }) => c.name === "Turquoise");
  if (leftover) await request.delete(`${apiUrl}/api/v1/colors/${leftover.id}`, { headers: auth });

  await page.goto("/settings");
  await page.getByRole("button", { name: /Couleurs/ }).click();

  // Des couleurs au-delà de bleu / noir / rouge sont proposées.
  const presets = page.getByRole("group", { name: "Palette de base" });
  await expect(presets.getByRole("button")).not.toHaveCount(3);
  await expect(presets.getByRole("button", { name: /Turquoise/ })).toBeEnabled();

  // Une couleur déjà dans la palette n'est plus proposée.
  await expect(presets.getByRole("button", { name: /Rouge/ })).toBeDisabled();

  await presets.getByRole("button", { name: /Turquoise/ }).click();
  await expect(page.getByPlaceholder("Nom (ex : Rouge)")).toHaveValue("Turquoise");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  // Supprimer : confirmation demandée, puis la couleur disparaît.
  await page.getByRole("button", { name: "Supprimer la couleur Turquoise" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Supprimer la couleur Turquoise" })).toHaveCount(0);

  // Une couleur utilisée ne peut pas être supprimée.
  await expect(page.getByRole("button", { name: "Supprimer la couleur Rouge" })).toBeDisabled();
});
