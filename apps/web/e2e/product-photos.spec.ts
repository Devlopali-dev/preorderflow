import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// PNG 1×1 : assez pour tester l'envoi d'images sans fichier de fixture.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const png = (name: string) => ({ name, mimeType: "image/png", buffer: TINY_PNG });

async function createProduct(request: APIRequestContext, token: string, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: authHeader(token),
      data: { sku: `${label}-${stamp}`, name: `${label} ${stamp}`, price: 2 },
    })
  ).json();
  const addPhoto = (name: string) =>
    request.post(`${apiUrl}/api/v1/products/${product.id}/photo`, {
      headers: authHeader(token),
      multipart: { file: png(name) },
    });
  const read = async () =>
    (
      await request.get(`${apiUrl}/api/v1/products/${product.id}`, { headers: authHeader(token) })
    ).json();
  const archive = () =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, {
      headers: authHeader(token),
    });
  return { product, addPhoto, read, archive };
}

test("un produit accepte 3 photos au plus, la quatrième est refusée, une photo se supprime", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const { product, addPhoto, read, archive } = await createProduct(request, token, "PHOTO-A");

  for (const name of ["un.png", "deux.png", "trois.png"]) {
    expect((await addPhoto(name)).status()).toBe(201);
  }
  const fourth = await addPhoto("quatre.png");
  expect(fourth.status()).toBe(400);
  expect((await fourth.json()).message).toMatch(/3 photos/);

  const full = await read();
  expect(full.photos).toHaveLength(3);
  expect(full.photos.map((p: { position: number }) => p.position)).toEqual([0, 1, 2]);

  // Le fichier est servi, puis disparaît du disque avec la photo supprimée.
  const [first, second] = full.photos as Array<{ id: string; url: string }>;
  expect((await request.get(`${apiUrl}${first.url}`)).status()).toBe(200);
  const removed = await request.delete(
    `${apiUrl}/api/v1/products/${product.id}/photos/${first.id}`,
    {
      headers: authHeader(token),
    },
  );
  expect(removed.ok()).toBe(true);
  expect((await request.get(`${apiUrl}${first.url}`)).status()).toBe(404);

  // Les photos restantes sont renumérotées, et on peut de nouveau en ajouter une.
  const after = await read();
  expect(after.photos.map((p: { id: string }) => p.id)[0]).toBe(second.id);
  expect(after.photos.map((p: { position: number }) => p.position)).toEqual([0, 1]);
  expect((await addPhoto("encore.png")).status()).toBe(201);

  // Une photo d'un autre produit n'est pas supprimable par ce produit.
  const other = await createProduct(request, token, "PHOTO-B");
  const wrong = await request.delete(
    `${apiUrl}/api/v1/products/${other.product.id}/photos/${second.id}`,
    { headers: authHeader(token) },
  );
  expect(wrong.status()).toBe(404);

  await archive();
  await other.archive();
});

test("à la création d'un produit, 3 photos au maximum : les fichiers en trop sont écartés", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const stamp = Date.now();
  const sku = `PHOTO-UI-${stamp}`;

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Nouveau produit" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(`Photos UI ${stamp}`);
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Prix").fill("4");

  // Modale assez large pour que tout le contenu y tienne, sans défilement horizontal.
  const dialog = page.getByRole("dialog");
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.width).toBeGreaterThanOrEqual(760);
  await page.getByRole("checkbox", { name: "Ce produit a des variantes" }).check();
  await page.getByRole("button", { name: "Gérer la palette de couleurs" }).click();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole("checkbox", { name: "Ce produit a des variantes" }).uncheck();

  const input = page.getByLabel(/^Photos \(optionnel/);
  await expect(input).toBeEnabled();
  // Cinq fichiers d'un coup : trois retenus, les autres écartés avec un message.
  await input.setInputFiles(["a", "b", "c", "d", "e"].map((n) => png(`${n}.png`)));
  await expect(page.getByLabel(/^Photos \(optionnel, 3\/3\)/)).toBeDisabled();
  await expect(page.getByText(/3 photos au maximum/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Retirer la photo/ })).toHaveCount(3);

  // Petits aperçus sur une seule ligne, bouton Retirer sous chaque image.
  const previews = page.getByRole("img", { name: /^Aperçu / });
  await expect(previews).toHaveCount(3);
  const boxes = await Promise.all([0, 1, 2].map((i) => previews.nth(i).boundingBox()));
  expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
  expect(boxes[0]!.width).toBeLessThanOrEqual(96);
  const retirer = await page.getByRole("button", { name: "Retirer la photo a.png" }).boundingBox();
  expect(retirer!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height - 1);

  // Retirer une photo libère une place.
  await page.getByRole("button", { name: "Retirer la photo c.png" }).click();
  await expect(page.getByLabel(/^Photos \(optionnel, 2\/3\)/)).toBeEnabled();
  await page.getByLabel(/^Photos \(optionnel/).setInputFiles(png("f.png"));
  await expect(page.getByLabel(/^Photos \(optionnel, 3\/3\)/)).toBeDisabled();

  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByLabel("SKU")).toHaveCount(0);

  const products = await (
    await request.get(`${apiUrl}/api/v1/products`, { headers: authHeader(token) })
  ).json();
  const product = products.find((p: { sku: string }) => p.sku === sku);
  expect(product.photos).toHaveLength(3);

  // Modale d'édition : trois photos, pas d'ajout possible, une suppression libère la place.
  await page.reload();
  await page.getByRole("button", { name: product.name, exact: true }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByRole("img", { name: /^Photo \d$/ })).toHaveCount(3);
  const thumbs = await Promise.all(
    [0, 1, 2].map((i) =>
      dialog
        .getByRole("img", { name: /^Photo \d$/ })
        .nth(i)
        .boundingBox(),
    ),
  );
  expect(new Set(thumbs.map((box) => Math.round(box!.y))).size).toBe(1);
  await expect(editDialog.getByText("Ajouter une photo")).toHaveCount(0);
  await editDialog.getByRole("button", { name: "Supprimer la photo 1" }).click();
  await expect(editDialog.getByRole("img", { name: /^Photo \d$/ })).toHaveCount(2);
  await expect(editDialog.getByText("Ajouter une photo")).toBeVisible();

  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, {
    headers: authHeader(token),
  });
});
