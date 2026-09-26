import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("la page stock affiche les produits", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Stock" })).toBeVisible();
  await expect(page.getByText("Sifflet anti-agression")).toBeVisible();
});

test("la page production affiche le lot du seed", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/production");
  await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
  await expect(page.getByText("2026-001")).toBeVisible();
});
