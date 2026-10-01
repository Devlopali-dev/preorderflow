import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// PNG 1×1 : assez pour tester l'envoi d'images sans fichier de fixture.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("à la création d'une campagne, les produits archivés sont en fin de liste et se réactivent après confirmation", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();

  // Un produit archivé dédié.
  const archived = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `CAMP-${stamp}`, name: `Produit archivé ${stamp}`, price: 3 },
    })
  ).json();
  await request.patch(`${apiUrl}/api/v1/products/${archived.id}/archive`, { headers: auth });

  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nouvelle campagne" }).click();

  const select = page.getByLabel("Produit");
  const labels = await select.locator("option").allTextContents();
  const firstArchived = labels.findIndex((label) => label.includes("(archivé)"));
  expect(firstArchived).toBeGreaterThan(0);
  // Tout ce qui suit le premier produit archivé est archivé : ils sont en fin de liste.
  expect(labels.slice(firstArchived).every((label) => label.includes("(archivé)"))).toBe(true);
  expect(labels.slice(0, firstArchived).some((label) => label.includes("(archivé)"))).toBe(false);

  // Choisir un produit archivé demande confirmation ; refuser garde la sélection.
  const before = await select.inputValue();
  await select.selectOption({ label: `Produit archivé ${stamp} (archivé)` });
  // Les boutons se cherchent dans leur boîte de dialogue : la liste derrière a ses
  // propres « Annuler » et « Réactiver ».
  const confirm = page.getByRole("dialog", { name: "Réactiver le produit" });
  await expect(confirm.getByText(/est archivé\. Le réactiver/)).toBeVisible();
  await confirm.getByRole("button", { name: "Annuler" }).click();
  await expect(confirm).toHaveCount(0);
  expect(await select.inputValue()).toBe(before);
  expect(
    (
      await (
        await request.get(`${apiUrl}/api/v1/products/${archived.id}`, { headers: auth })
      ).json()
    ).active,
  ).toBe(false);

  // Confirmer réactive le produit et le sélectionne.
  await select.selectOption({ label: `Produit archivé ${stamp} (archivé)` });
  await confirm.getByRole("button", { name: "Réactiver" }).click();
  await expect(select.locator("option:checked")).toHaveText(`Produit archivé ${stamp}`);
  expect(
    (
      await (
        await request.get(`${apiUrl}/api/v1/products/${archived.id}`, { headers: auth })
      ).json()
    ).active,
  ).toBe(true);

  await request.patch(`${apiUrl}/api/v1/products/${archived.id}/archive`, { headers: auth });
});

test("une campagne se crée avec ses dates et ses images envoyées, comme dans la modale d'édition", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const name = `Campagne UI ${stamp}`;

  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nouvelle campagne" }).click();

  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Début").fill("2026-11-01");
  await page.getByLabel("Fin (deadline)").fill("2026-12-15");

  // Plus de champs « URL » : les images se téléversent, comme à l'édition.
  await expect(page.getByLabel("URL de l'image")).toHaveCount(0);
  await expect(page.getByLabel("URL du PDF de présentation")).toHaveCount(0);
  await page
    .getByText("Ajouter une image")
    .locator("..")
    .locator("input")
    .setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "b.png", mimeType: "image/png", buffer: TINY_PNG },
    ]);
  await expect(page.getByText("Aperçus (2/5)")).toBeVisible();

  await page.getByRole("button", { name: "Créer", exact: true }).click();
  // La modale se ferme une fois la campagne créée et ses images envoyées.
  await expect(page.getByLabel("Nom", { exact: true })).toHaveCount(0);

  const campaigns = await (await request.get(`${apiUrl}/api/v1/campaigns`)).json();
  const campaign = campaigns.find((c: { name: string }) => c.name === name);
  expect(campaign.media).toHaveLength(2);
  expect(campaign.startDate).toMatch(/^2026-11-01/);
  expect(campaign.endDate).toMatch(/^2026-12-15/);

  // Nettoyage : annulée puis supprimée.
  await request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
    headers: auth,
    data: { status: "ANNULEE" },
  });
  await request.delete(`${apiUrl}/api/v1/campaigns/${campaign.id}`, { headers: auth });
});

test("les archives sont repliées, en lecture seule, réactivables et supprimables", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const name = `Campagne archive ${stamp}`;

  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const campaign = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: { name, slug: `archive-${stamp}`, productId: product.id },
    })
  ).json();
  const setStatus = (status: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
      headers: auth,
      data: { status },
    });
  await setStatus("ANNULEE");

  // Archives repliées par défaut : la campagne n'est pas visible.
  await page.goto("/campaigns");
  await expect(page.getByRole("button", { name })).toHaveCount(0);
  await page.getByRole("button", { name: /Archives/ }).click();
  const row = page.locator("tr", { hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Réactiver" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Supprimer définitivement" })).toBeVisible();

  // Lecture seule : champs désactivés, pas d'Enregistrer, pas d'ajout d'aperçu.
  await row.getByRole("button", { name }).click();
  await expect(page.getByText("Campagne archivée (lecture seule)")).toBeVisible();
  await expect(page.getByLabel("Nom", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Début")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  await expect(page.getByText("Ajouter une image")).toHaveCount(0);

  // Réactiver depuis la modale : retour en brouillon, modifiable.
  await page
    .getByRole("dialog", { name: "Campagne archivée (lecture seule)" })
    .getByRole("button", { name: "Réactiver" })
    .click();
  await expect(page.getByText("Campagne archivée (lecture seule)")).toHaveCount(0);
  const reactivated = await (await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}`)).json();
  expect(reactivated.status).toBe("DRAFT");

  // Annulée de nouveau, puis suppression définitive depuis la liste des archives.
  await setStatus("ANNULEE");
  await page.reload();
  await page.getByRole("button", { name: /Archives/ }).click();
  await row.getByRole("button", { name: "Supprimer définitivement" }).click();
  await page
    .getByRole("dialog", { name: "Supprimer définitivement" })
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(row).toHaveCount(0);
  expect((await request.get(`${apiUrl}/api/v1/campaigns/${campaign.id}`)).status()).toBe(404);
});

test("nouvelle campagne : images et PDF en petits aperçus sur une ligne, bouton Retirer dessous, 5 au maximum", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page, request);
  const png = (name: string) => ({ name, mimeType: "image/png", buffer: TINY_PNG });
  // Le PDF n'est pas envoyé (la campagne n'est pas créée) : un contenu minimal suffit.
  const pdf = {
    name: "dossier.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n"),
  };

  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nouvelle campagne" }).click();
  const dialog = page.getByRole("dialog");
  const images = dialog.getByText("Ajouter une image").locator("..").locator("input");
  const pdfInput = dialog.getByText("Ajouter un PDF").locator("..").locator("input");

  await images.setInputFiles(["a", "b", "c"].map((n) => png(`${n}.png`)));
  await pdfInput.setInputFiles(pdf);
  await expect(dialog.getByText("Aperçus (4/5)")).toBeVisible();

  // Trois images et le PDF : une seule ligne, chaque aperçu est petit, Retirer en dessous.
  const previews = dialog.getByRole("img", { name: /^Aperçu / });
  await expect(previews).toHaveCount(4);
  const boxes = await Promise.all([0, 1, 2, 3].map((i) => previews.nth(i).boundingBox()));
  expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
  expect(boxes.every((box) => box!.width <= 96)).toBe(true);
  const retirer = await dialog.getByRole("button", { name: "Retirer l'image a.png" }).boundingBox();
  expect(retirer!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height - 1);
  await expect(dialog.getByRole("img", { name: "Aperçu du PDF dossier.pdf" })).toContainText("PDF");

  // Un seul PDF : le champ se bloque ; cinq aperçus au plus, le surplus est écarté avec un message.
  await expect(pdfInput).toBeDisabled();
  await images.setInputFiles(["d", "e", "f"].map((n) => png(`${n}.png`)));
  await expect(dialog.getByText("Aperçus (5/5)")).toBeVisible();
  await expect(dialog.getByText(/5 aperçus au maximum/)).toBeVisible();
  await expect(images).toBeDisabled();

  // Retirer libère une place, y compris celle du PDF.
  await dialog.getByRole("button", { name: "Retirer l'image d.png" }).click();
  await expect(dialog.getByText("Aperçus (4/5)")).toBeVisible();
  await expect(images).toBeEnabled();
  await dialog.getByRole("button", { name: "Retirer le PDF dossier.pdf" }).click();
  await expect(dialog.getByText("Aperçus (3/5)")).toBeVisible();
  await expect(pdfInput).toBeEnabled();
  await expect(dialog.getByRole("img", { name: /^Aperçu du PDF/ })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Annuler" }).click();
});
