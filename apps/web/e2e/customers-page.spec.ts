import { test, expect } from "@playwright/test";
import { authHeader, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Address {
  type: string;
  company: string | null;
  address2: string | null;
  phone: string | null;
  city: string;
}

test("un client se crée depuis l'interface avec toutes ses informations", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const email = `ui-client-${stamp}@example.com`;

  await page.goto("/customers");
  await page.getByRole("button", { name: "Nouveau client" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau client" });

  // Identité, avant d'ajouter des adresses (les libellés se répètent ensuite).
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Prénom", { exact: true }).fill(`Ui${stamp}`);
  await dialog.getByLabel("Nom", { exact: true }).fill("Client");
  await dialog.getByLabel("Téléphone", { exact: true }).fill("0611223344");

  // Une adresse de facturation complète…
  await dialog.getByRole("button", { name: "Ajouter une adresse" }).click();
  const billing = dialog.getByRole("group", { name: "Adresse 1" });
  await expect(billing.getByLabel("Type")).toHaveValue("BILLING");
  await billing.getByLabel("Société (optionnel)").fill("Atelier Test");
  await billing.getByLabel("Adresse", { exact: true }).fill("8 rue de la Paix");
  await billing.getByLabel("Complément (optionnel)").fill("Étage 2");
  await billing.getByLabel("Code postal").fill("75002");
  await billing.getByLabel("Ville").fill("Paris");
  await billing.getByLabel("Téléphone de livraison (optionnel)").fill("0699887766");

  // … et une adresse de livraison, proposée en second.
  await dialog.getByRole("button", { name: "Ajouter une adresse" }).click();
  const shipping = dialog.getByRole("group", { name: "Adresse 2" });
  await expect(shipping.getByLabel("Type")).toHaveValue("SHIPPING");
  await shipping.getByLabel("Adresse", { exact: true }).fill("1 quai du Port");
  await shipping.getByLabel("Code postal").fill("13002");
  await shipping.getByLabel("Ville").fill("Marseille");

  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const customers = await (
    await request.get(`${apiUrl}/api/v1/customers`, { headers: auth })
  ).json();
  const created = customers.find((c: { email: string }) => c.email === email);
  const detail = await (
    await request.get(`${apiUrl}/api/v1/customers/${created.id}`, { headers: auth })
  ).json();
  expect(detail.phone).toBe("0611223344");
  expect(detail.addresses).toHaveLength(2);
  const facturation = detail.addresses.find((a: Address) => a.type === "BILLING");
  expect(facturation.company).toBe("Atelier Test");
  expect(facturation.address2).toBe("Étage 2");
  expect(facturation.phone).toBe("0699887766");
  expect(detail.addresses.find((a: Address) => a.type === "SHIPPING").city).toBe("Marseille");

  await request.post(`${apiUrl}/api/v1/customers/${created.id}/gdpr-anonymize`, { headers: auth });
});

test("toutes les informations d'un client se modifient depuis l'interface", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();
  const firstName = `Modif${stamp}`;

  const customer = await (
    await request.post(`${apiUrl}/api/v1/customers`, {
      headers: auth,
      data: {
        email: `ui-modif-${stamp}@example.com`,
        firstName,
        lastName: "Client",
        addresses: [
          {
            type: "BILLING",
            firstName,
            lastName: "Client",
            address1: "5 avenue Foch",
            postalCode: "69006",
            city: "Lyon",
            country: "FR",
          },
        ],
      },
    })
  ).json();

  await page.goto("/customers");
  await page.getByRole("button", { name: `${firstName} Client` }).click();
  // Une seule modale ouverte : on ne la cherche pas par son titre, qui change
  // avec le prénom une fois le client modifié.
  const dialog = page.getByRole("dialog");

  // Lecture : l'adresse complète est affichée.
  await expect(dialog.getByText(/5 avenue Foch, 69006 Lyon/)).toBeVisible();

  // Modification de tout : identité, email, téléphone, adresse, nouvelle adresse.
  await dialog.getByRole("button", { name: "Modifier" }).click();
  const newEmail = `ui-modif-2-${stamp}@example.com`;
  await dialog.getByLabel("Email").fill(newEmail);
  await dialog.getByLabel("Prénom", { exact: true }).first().fill(`${firstName}bis`);
  await dialog.getByLabel("Téléphone", { exact: true }).fill("0700112233");
  await dialog.getByRole("group", { name: "Adresse 1" }).getByLabel("Ville").fill("Villeurbanne");
  await dialog.getByRole("button", { name: "Ajouter une adresse" }).click();
  const added = dialog.getByRole("group", { name: "Adresse 2" });
  await added.getByLabel("Adresse", { exact: true }).fill("2 rue Neuve");
  await added.getByLabel("Code postal").fill("59000");
  await added.getByLabel("Ville").fill("Lille");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();

  // Retour en lecture avec les nouvelles valeurs.
  await expect(dialog.getByRole("button", { name: "Modifier" })).toBeVisible();
  await expect(dialog.getByText(/Villeurbanne/)).toBeVisible();
  await expect(dialog.getByText(/2 rue Neuve, 59000 Lille/)).toBeVisible();

  const detail = await (
    await request.get(`${apiUrl}/api/v1/customers/${customer.id}`, { headers: auth })
  ).json();
  expect(detail.email).toBe(newEmail);
  expect(detail.firstName).toBe(`${firstName}bis`);
  expect(detail.phone).toBe("0700112233");
  expect(detail.addresses).toHaveLength(2);

  // Retirer une adresse depuis le formulaire la supprime.
  await dialog.getByRole("button", { name: "Modifier" }).click();
  await dialog.getByRole("button", { name: "Retirer l'adresse 2" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog.getByRole("button", { name: "Modifier" })).toBeVisible();
  expect(
    (
      await (
        await request.get(`${apiUrl}/api/v1/customers/${customer.id}`, { headers: auth })
      ).json()
    ).addresses,
  ).toHaveLength(1);

  await request.post(`${apiUrl}/api/v1/customers/${customer.id}/gdpr-anonymize`, { headers: auth });
});

test("un client anonymisé n'a plus de bouton Modifier", async ({ page, request }) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = Date.now();

  const customer = await (
    await request.post(`${apiUrl}/api/v1/customers`, {
      headers: auth,
      data: {
        email: `ui-anon-${stamp}@example.com`,
        firstName: `Anon${stamp}`,
        lastName: "Client",
      },
    })
  ).json();
  await request.post(`${apiUrl}/api/v1/customers/${customer.id}/gdpr-anonymize`, { headers: auth });

  await page.goto("/customers");
  await page.getByRole("button", { name: "Anonymisé Anonymisé" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Anonymisé Anonymisé" });
  await expect(dialog.getByRole("button", { name: "Fermer" }).last()).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Modifier" })).toHaveCount(0);
});
