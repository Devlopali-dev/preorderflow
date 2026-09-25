import { test, expect } from "@playwright/test";

test("la page d'accueil se charge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PreOrderFlow" })).toBeVisible();
});
