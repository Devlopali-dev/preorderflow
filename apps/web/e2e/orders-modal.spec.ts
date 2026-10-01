import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Commande dédiée au test, amenée au statut voulu par l'API.
async function createOrder(request: APIRequestContext, token: string, statuses: string[] = []) {
  const auth = authHeader(token);
  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const variant = product.variants.find((v: { active: boolean }) => v.active);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const order = await (
    await request.post(`${apiUrl}/api/v1/orders`, {
      headers: auth,
      data: {
        customerEmail: `orders-modal-${stamp}@example.com`,
        customerFirstName: "Modale",
        customerLastName: "Commande",
        items: [{ variantId: variant.id, quantity: 1 }],
        shippingAddress: {
          firstName: "Modale",
          lastName: "Commande",
          address1: "1 rue",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
      },
    })
  ).json();

  const setStatus = (status: string) =>
    request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status },
    });
  for (const status of statuses) await setStatus(status);

  const addPayment = () =>
    request.post(`${apiUrl}/api/v1/orders/${order.id}/payments`, {
      headers: auth,
      data: { provider: "BANK_TRANSFER" },
    });
  const payments = async () =>
    (await (await request.get(`${apiUrl}/api/v1/payments`, { headers: auth })).json()).filter(
      (p: { orderId: string }) => p.orderId === order.id,
    ) as Array<{ id: string; status: string }>;

  return { order, setStatus, addPayment, payments };
}

test("une commande annulée refuse tout paiement, et la confirmation n'écrit rien", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const auth = authHeader(token);
  const { order, setStatus, addPayment, payments } = await createOrder(request, token, [
    "PENDING_PAYMENT",
  ]);

  // Un paiement en attente existe avant l'annulation.
  expect((await addPayment()).status()).toBe(201);
  const [pending] = await payments();
  expect(pending.status).toBe("PENDING");

  expect((await setStatus("CANCELLED")).ok()).toBe(true);

  // Confirmer ce paiement est refusé, et rien n'est écrit : le paiement reste en
  // attente (avant le correctif il passait à « payé » sur une commande annulée).
  const confirm = await request.post(`${apiUrl}/api/v1/payments/${pending.id}/confirm`, {
    headers: auth,
  });
  expect(confirm.status()).toBe(400);
  expect((await confirm.json()).message).toMatch(/annulée/);
  expect((await payments())[0].status).toBe("PENDING");

  // Pas non plus de nouveau paiement.
  const created = await addPayment();
  expect(created.status()).toBe(400);
  expect(await payments()).toHaveLength(1);
  expect(order.id).toBeTruthy();
});

test("la modale d'une commande annulée a un paiement en lecture seule et ni pied ni section Statut", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const { order, setStatus, addPayment } = await createOrder(request, token, ["PENDING_PAYMENT"]);
  await addPayment();
  await setStatus("CANCELLED");

  await page.goto("/orders");
  await page.getByRole("button", { name: order.number, exact: true }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByText(/paiement en lecture\s+seule/)).toBeVisible();
  await expect(dialog.getByText(/Virement bancaire — .* — en attente/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Générer le paiement" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Marquer comme payée" })).toHaveCount(0);

  // Plus de section « Statut » vide, ni de boutons de statut.
  await expect(dialog.getByRole("heading", { name: "Statut", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Passer à/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Rembourser" })).toHaveCount(0);
});

test("la modale d'une commande en cours a ses boutons de statut en bas, après les autres sections", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const { order, setStatus } = await createOrder(request, token, ["PENDING_PAYMENT"]);

  await page.goto("/orders");
  await page.getByRole("button", { name: order.number, exact: true }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("heading", { name: "Statut", exact: true })).toHaveCount(0);
  const action = dialog.getByRole("button", { name: "Passer à PAID" });
  await expect(action).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annuler", exact: true })).toBeVisible();

  // Les boutons sont après la section Préparation & expédition, pas au milieu.
  const lastSection = await dialog.getByRole("heading", { name: /Préparation/ }).boundingBox();
  const actionBox = await action.boundingBox();
  expect(actionBox!.y).toBeGreaterThan(lastSection!.y);

  await setStatus("CANCELLED");
});

test("les cartes du dashboard mènent au groupe exact de la page commandes", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  // Un groupe par carte, garanti par des commandes dédiées.
  const toPay = await createOrder(request, token, ["PENDING_PAYMENT"]);
  const toPrepare = await createOrder(request, token, ["PENDING_PAYMENT", "PAID"]);
  const toShip = await createOrder(request, token, [
    "PENDING_PAYMENT",
    "PAID",
    "PROCESSING",
    "READY_TO_SHIP",
  ]);

  const cases = [
    { card: "Commandes à payer", anchor: "orders-PENDING_PAYMENT" },
    { card: "Commandes à préparer", anchor: "orders-PAID" },
    { card: "Commandes à expédier", anchor: "orders-READY_TO_SHIP" },
  ];
  for (const { card, anchor } of cases) {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: new RegExp(card) }).click();
    await expect(page).toHaveURL(new RegExp(`/orders#${anchor}$`));
    await expect(page.locator(`#${anchor}`)).toBeInViewport();
  }

  // Nettoyage : annulée / remboursées.
  await toPay.setStatus("CANCELLED");
  await toPrepare.setStatus("REFUNDED");
  await toShip.setStatus("REFUNDED");
});
