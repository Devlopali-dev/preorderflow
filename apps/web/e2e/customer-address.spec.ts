import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";
import { loginAsCustomer } from "./magic-link";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// L'adresse que le client enregistre dans son profil doit remonter dans l'administration.
test("l'adresse enregistrée dans le profil client remonte dans l'admin, et se met à jour sans doublon", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const email = `profil-adresse-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

  // Client sans aucune adresse (créé par l'admin, comme après un recensement).
  const created = await (
    await request.post(`${apiUrl}/api/v1/customers`, {
      headers: auth,
      data: { email, firstName: "Paul", lastName: "Profil" },
    })
  ).json();
  const addresses = async () =>
    (
      await (
        await request.get(`${apiUrl}/api/v1/customers/${created.id}`, { headers: auth })
      ).json()
    ).addresses as Array<{ type: string; address1: string; city: string }>;
  expect(await addresses()).toHaveLength(0);

  await loginAsCustomer(page, email);
  await page.goto("/mon-compte/profil");

  // Une adresse à moitié remplie est refusée côté formulaire, rien n'est enregistré.
  await page.getByLabel("Adresse", { exact: true }).fill("8 rue du Port");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Complétez l'adresse/)).toBeVisible();
  expect(await addresses()).toHaveLength(0);

  await page.getByLabel("Code postal").fill("44000");
  await page.getByLabel("Ville").fill("Nantes");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations mises à jour.")).toBeVisible();

  // Livraison et facturation dans le carnet : c'est ce que l'admin affiche.
  const first = await addresses();
  expect(first.map((a) => a.type).sort()).toEqual(["BILLING", "SHIPPING"]);
  expect(first.every((a) => a.address1 === "8 rue du Port" && a.city === "Nantes")).toBe(true);

  // Après rechargement, le formulaire est prérempli ; une modification met à jour la livraison, sans doublon.
  await page.reload();
  await expect(page.getByLabel("Ville")).toHaveValue("Nantes");
  await page.getByLabel("Ville").fill("Rezé");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations mises à jour.")).toBeVisible();
  const second = await addresses();
  expect(second).toHaveLength(2);
  expect(second.find((a) => a.type === "SHIPPING")?.city).toBe("Rezé");
  expect(second.find((a) => a.type === "BILLING")?.city).toBe("Nantes");
});
