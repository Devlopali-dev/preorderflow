import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";
import { loginAsCustomer } from "./magic-link";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CUSTOMER_EMAIL = "client3@example.com";

// Commande en brouillon pour un client du seed (le même nom évite de renommer le client).
async function draftOrderFor(request: APIRequestContext, token: string) {
  const auth = authHeader(token);
  const customers = await (
    await request.get(`${apiUrl}/api/v1/customers`, { headers: auth })
  ).json();
  const customer = customers.find((c: { email: string }) => c.email === CUSTOMER_EMAIL);
  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");

  const order = await (
    await request.post(`${apiUrl}/api/v1/orders`, {
      headers: auth,
      data: {
        customerEmail: CUSTOMER_EMAIL,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName,
        items: [
          {
            variantId: product.variants.find((v: { active: boolean }) => v.active).id,
            quantity: 2,
          },
        ],
        shippingAddress: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          address1: "1 rue",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
      },
    })
  ).json();

  const read = async () =>
    (await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })).json();
  const cancel = () =>
    request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status: "CANCELLED" },
    });
  return { order, read, cancel };
}

test("« Oui, payer maintenant » affiche le lien Revolut avec le montant et met la commande en attente de paiement", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const { order, read, cancel } = await draftOrderFor(request, token);

  await loginAsCustomer(page, CUSTOMER_EMAIL);
  await page.goto(`/mon-compte/commandes/${order.id}`);
  await expect(page.getByText("Souhaitez-vous payer directement ?")).toBeVisible();
  await page.getByRole("button", { name: "Oui, payer maintenant" }).click();

  // Montant attendu, lien avec ce montant en centimes, consigne sur la remarque.
  const link = page.getByRole("link", { name: "Payer avec Revolut" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`amount=${Math.round(Number(order.total) * 100)}$`),
  );
  await expect(page.getByText(/nom et prénom/)).toBeVisible();
  await expect(page.getByText(/remarque/)).toBeVisible();

  // Commande en attente de paiement, un seul règlement manuel à vérifier.
  const after = await read();
  expect(after.status).toBe("PENDING_PAYMENT");
  expect(after.payments).toHaveLength(1);
  expect(after.payments[0]).toMatchObject({ provider: "MANUAL", status: "PENDING" });

  // Revenir sur la page réaffiche le lien, sans créer de second règlement.
  await page.reload();
  await expect(page.getByRole("link", { name: "Payer avec Revolut" })).toBeVisible();
  expect((await read()).payments).toHaveLength(1);

  await cancel();
});

test("« Non, plus tard » prévient qu'un e-mail de validation parviendra, sans rien générer", async ({
  page,
  request,
}) => {
  const token = await getAdminToken(request);
  const { order, read, cancel } = await draftOrderFor(request, token);

  await loginAsCustomer(page, CUSTOMER_EMAIL);
  await page.goto(`/mon-compte/commandes/${order.id}`);
  await page.getByRole("button", { name: "Non, plus tard" }).click();
  await expect(
    page.getByText(/un e-mail vous parviendra pour valider votre commande/),
  ).toBeVisible();

  const after = await read();
  expect(after.status).toBe("DRAFT");
  expect(after.payments).toHaveLength(0);

  await cancel();
});
