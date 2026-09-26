import { test, expect } from "@playwright/test";

test("une page admin sans session redirige vers /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("un login avec un mauvais mot de passe est refusé", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@preorderflow.dev");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/incorrect/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("un login valide donne accès au dashboard puis la déconnexion révoque l'accès", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@preorderflow.dev");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Campagnes actives")).toBeVisible();

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Retour en arrière : sans session, retombe sur login
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
