import { test, expect } from "@playwright/test";

// Les campagnes de démo suivent leur statut : « Gourde inox #1 » est en recensement, « Stylo #1 » aux commandes ouvertes.
test("un visiteur peut consulter une campagne en recensement et voir le formulaire de recensement", async ({
  page,
}) => {
  await page.goto("/campaigns/gourde-inox-1");
  await expect(page.getByRole("heading", { name: "Gourde inox #1" })).toBeVisible();
  await expect(page.getByText("ne constitue pas une commande")).toBeVisible();
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toBeVisible();
});

test("une campagne aux commandes ouvertes affiche le formulaire d'achat, pas celui du recensement", async ({
  page,
}) => {
  await page.goto("/campaigns/stylo-1");
  await expect(page.getByRole("heading", { name: "Stylo #1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commander" })).toBeVisible();
  await expect(page.getByText("ne constitue pas une commande")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toHaveCount(0);
});

test("une campagne inexistante renvoie une 404", async ({ page }) => {
  const response = await page.goto("/campaigns/campagne-qui-n-existe-pas");
  expect(response?.status()).toBe(404);
});
