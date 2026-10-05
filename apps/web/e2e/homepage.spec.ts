import { test, expect } from "@playwright/test";

test("la page d'accueil se charge", async ({ page }) => {
  await page.goto("/");
  // L'en-tête public porte le nom du site, avec un lien vers l'accueil.
  await expect(
    page.getByRole("banner").getByRole("link", { name: "PreOrderFlow" }),
  ).toHaveAttribute("href", "/");
});
