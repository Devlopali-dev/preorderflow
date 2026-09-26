import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("le dashboard admin affiche les indicateurs clés", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/dashboard");
  await expect(page.getByText("Campagnes actives")).toBeVisible();
  await expect(page.getByText("Commandes à payer")).toBeVisible();
});

test("la liste des commandes affiche les commandes du seed", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
  await expect(page.getByText(/2026-\d{4}/).first()).toBeVisible();
});

test("la liste des clients affiche les clients du seed", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  await expect(page.getByText(/client\d+@example\.com/).first()).toBeVisible();
});
