import { test, expect } from "@playwright/test";

test("un visiteur peut consulter une campagne et voir le formulaire de recensement", async ({
  page,
}) => {
  await page.goto("/campaigns/stylo-1");
  await expect(page.getByRole("heading", { name: "Stylo #1" })).toBeVisible();
  await expect(page.getByText("ne constitue pas une commande")).toBeVisible();
  await expect(page.getByRole("button", { name: "Je participe au recensement" })).toBeVisible();
});

test("une campagne inexistante renvoie une 404", async ({ page }) => {
  const response = await page.goto("/campaigns/campagne-qui-n-existe-pas");
  expect(response?.status()).toBe(404);
});
