import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { authHeader, isStableColor, loginAsAdmin } from "./helpers";

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

  // Deux couleurs actives de la palette : les DEUX DERNIÈRES, car variants.spec
  // désactive temporairement les premières, en parallèle.
  const [first, second] = (
    await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json()
  )
    .filter(isStableColor)
    .slice(-2) as Array<{
    name: string;
  }>;

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Nouveau produit" }).click();

  // Le slug n'est plus saisi, et le SKU se propose depuis le nom.
  await expect(page.getByLabel("Slug")).toHaveCount(0);
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await expect(page.getByLabel("SKU")).toHaveValue(`PRODUIT-UI-${stamp}`);
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Description (optionnel)").fill("Créé par le test de la page produits");
  await page.getByLabel("Prix").fill("9.90");
  await page.getByLabel(/^Photos \(optionnel/).setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // Les couleurs n'apparaissent que si le produit a des variantes.
  await expect(page.getByRole("group", { name: "Palette de couleurs" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Ce produit a des variantes" }).check();
  // Pas de cases à cocher : un clic sur la palette ajoute la couleur aux couleurs proposées.
  await page.getByRole("button", { name: "Gérer la palette de couleurs" }).click();
  const palette = page.getByRole("group", { name: "Palette de couleurs" });
  await palette.getByRole("button", { name: first.name }).click();
  await palette.getByRole("button", { name: second.name }).click();
  const proposed = page.getByRole("list", { name: "Couleurs proposées" });
  await expect(proposed).toContainText(first.name);
  await expect(proposed).toContainText(second.name);

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
  expect(product.photos).toHaveLength(1);
  expect(product.photos[0].url).toMatch(/^\/uploads\/products\//);
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

// La palette se gère depuis la modale d'un produit, pas depuis /settings.
async function openPaletteFromNewProductModal(page: Page) {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Nouveau produit" }).click();
  await page.getByRole("checkbox", { name: "Ce produit a des variantes" }).check();
  await page.getByRole("button", { name: "Gérer la palette de couleurs" }).click();
}

// Palette de la modale d'un produit existant (liste de gestion : désactiver, supprimer).
async function openPaletteFromProductModal(page: Page, request: APIRequestContext, token: string) {
  const products = await (
    await request.get(`${apiUrl}/api/v1/products`, { headers: authHeader(token) })
  ).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  await page.goto("/inventory");
  await page.getByRole("button", { name: product.name, exact: true }).click();
  await page.getByRole("button", { name: "Gérer la palette de couleurs" }).click();
}

test("la palette de couleurs n'est plus dans les paramètres", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Couleurs" })).toHaveCount(0);
  await expect(page.getByText("Palette de base")).toHaveCount(0);
});

test("la palette se gère aussi depuis la modale d'un produit existant", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const products = await (
    await request.get(`${apiUrl}/api/v1/products`, { headers: authHeader(token) })
  ).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");

  await page.goto("/inventory");
  await page.getByRole("button", { name: product.name, exact: true }).click();
  await page.getByRole("button", { name: "Gérer la palette de couleurs" }).click();
  await expect(page.getByRole("group", { name: "Palette de base" })).toBeVisible();
  await expect(page.getByPlaceholder("Nom (ex : Rouge)")).toBeVisible();
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
    await openPaletteFromProductModal(page, request, token);
    const row = page.locator("li", { hasText: name });
    await expect(row.locator("span.italic", { hasText: name })).toBeVisible();
    await expect(row.locator(".badge-warning", { hasText: "inactive" })).toBeVisible();
  } finally {
    await request.delete(`${apiUrl}/api/v1/colors/${created.id}`, { headers: auth });
  }
});

test("modale d'un produit existant : la palette de base ajoute et retire une couleur en un clic", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const bordeaux = async () =>
    (
      (await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json()) as Array<{
        id: string;
        name: string;
        active: boolean;
      }>
    ).find((c) => c.name === "Bordeaux");

  // État de départ propre si un run précédent a été interrompu.
  const leftover = await bordeaux();
  if (leftover) await request.delete(`${apiUrl}/api/v1/colors/${leftover.id}`, { headers: auth });

  await openPaletteFromProductModal(page, request, token);
  const presets = page.getByRole("group", { name: "Palette de base" });
  const button = presets.getByRole("button", { name: /Bordeaux/ });

  // Des couleurs au-delà de bleu / noir / rouge sont proposées, non enfoncées.
  await expect(presets.getByRole("button")).not.toHaveCount(3);
  await expect(button).toHaveAttribute("aria-pressed", "false");

  // Un clic ajoute la couleur à la palette, sans passer par le champ « Nouvelle couleur ».
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect((await bordeaux())?.active).toBe(true);

  // Un second clic la retire (supprimée : aucun produit ne l'utilise).
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await bordeaux()).toBeUndefined();

  // Une couleur utilisée par un produit se désactive au lieu d'être supprimée : on le
  // lit sur l'infobulle, sans toucher à la couleur partagée du seed.
  await expect(presets.getByRole("button", { name: /Rouge/ })).toHaveAttribute(
    "title",
    /utilisée par un produit/,
  );
});

test("création d'un produit : un clic sur la palette ajoute la couleur aux couleurs proposées, sans case à cocher", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const colorOf = async () =>
    (
      (await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json()) as Array<{
        id: string;
        name: string;
        active: boolean;
      }>
    ).find((c) => c.name === "Turquoise");
  const leftover = await colorOf();
  if (leftover) await request.delete(`${apiUrl}/api/v1/colors/${leftover.id}`, { headers: auth });

  await openPaletteFromNewProductModal(page);
  // Plus de cases à cocher pour les couleurs, ni de liste « Activer / Supprimer ».
  await expect(page.getByRole("checkbox")).toHaveCount(1); // seule reste « a des variantes »
  await expect(page.getByRole("button", { name: /^Supprimer la couleur/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Désactiver" })).toHaveCount(0);

  const palette = page.getByRole("group", { name: "Palette de couleurs" });
  const button = palette.getByRole("button", { name: /Turquoise/ });
  const proposed = page.getByRole("list", { name: "Couleurs proposées" });

  // Un clic crée la couleur si besoin et l'ajoute aux couleurs proposées, au-dessus du bouton de palette.
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(proposed).toContainText("Turquoise");
  const listBox = await proposed.boundingBox();
  const toggleBox = await page
    .getByRole("button", { name: "Masquer la palette de couleurs" })
    .boundingBox();
  expect(listBox!.y).toBeLessThan(toggleBox!.y);
  expect((await colorOf())?.active).toBe(true);

  // Un second clic la retire du produit, sans la supprimer de la palette.
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("list", { name: "Couleurs proposées" }).getByText("Turquoise"),
  ).toHaveCount(0);
  expect((await colorOf())?.active).toBe(true);

  const created = await colorOf();
  await request.delete(`${apiUrl}/api/v1/colors/${created!.id}`, { headers: auth });
});

test("les lignes de variantes sont réellement décalées par rapport à celle du produit", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page, request);
  await page.goto("/inventory");

  // Le décalage se mesure sur le CSS calculé : une classe peut être présente sans
  // effet si une règle plus spécifique écrase son padding (régression réelle).
  const paddingLeft = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((cell) => parseFloat(getComputedStyle(cell).paddingLeft));
  const productCell = await paddingLeft("tbody tr:not(:has(td.table-indent)) td:first-child");
  const variantCell = await paddingLeft("td.table-indent");

  expect(variantCell).toBeGreaterThan(productCell);
  expect(variantCell).toBeGreaterThanOrEqual(productCell + 16);
});

test("une couleur créée via la palette est sélectionnée d'office à la création d'un produit", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const colorName = `Auto-${Date.now()}`;

  await openPaletteFromNewProductModal(page);
  await page.getByPlaceholder("Nom (ex : Rouge)").fill(colorName);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  // Cochée sans autre geste ; les couleurs existantes, elles, restent décochées.
  await expect(page.getByRole("list", { name: "Couleurs proposées" })).toContainText(colorName);
  await expect(page.getByRole("list", { name: "Couleurs proposées" })).not.toContainText("Noir");

  // Nettoyage : la couleur n'est utilisée par aucun produit.
  const colors = await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json();
  const created = colors.find((c: { name: string }) => c.name === colorName);
  await request.delete(`${apiUrl}/api/v1/colors/${created.id}`, { headers: auth });
});

test("choisir une couleur dans la modale d'un produit l'ajoute aussitôt, sans bouton Ajouter", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const name = `Select ${stamp}`;

  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `SEL-${stamp}`, name, price: 1 },
    })
  ).json();
  const colors = (await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json())
    .filter(isStableColor)
    .slice(-1) as Array<{ id: string; name: string }>;
  const [color] = colors;

  await page.goto("/inventory");
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("button", { name: "Ajouter", exact: true })).toHaveCount(0);
  await dialog.getByLabel("Ajouter une couleur").selectOption({ label: color.name });

  // La couleur apparaît dans la liste du produit et disparaît de la liste déroulante.
  await expect(dialog.locator("li", { hasText: color.name })).toBeVisible();
  await expect(
    dialog.getByLabel("Ajouter une couleur").locator("option", { hasText: color.name }),
  ).toHaveCount(0);

  const variants = (
    await (await request.get(`${apiUrl}/api/v1/products/${product.id}`, { headers: auth })).json()
  ).variants as Array<{ color: { name: string } | null }>;
  expect(variants.map((v) => v.color?.name)).toEqual([color.name]);

  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
});
