import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin, payOrder } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Commande prête à expédier (payée réellement ou seulement passée à « payée »
// à la main), avec son expédition déjà expédiée.
async function shippedOrder(request: APIRequestContext, token: string, opts: { paid: boolean }) {
  const auth = authHeader(token);
  const products = await (await request.get(`${apiUrl}/api/v1/products`, { headers: auth })).json();
  const product = products.find((p: { sku: string }) => p.sku === "STYLO-001");
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const order = await (
    await request.post(`${apiUrl}/api/v1/orders`, {
      headers: auth,
      data: {
        customerEmail: `livraison-${stamp}@example.com`,
        customerFirstName: "Livraison",
        customerLastName: "Test",
        items: [
          {
            variantId: product.variants.find((v: { active: boolean }) => v.active).id,
            quantity: 1,
          },
        ],
        shippingAddress: {
          firstName: "Livraison",
          lastName: "Test",
          address1: "1 rue",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
      },
    })
  ).json();

  const setOrder = (status: string) =>
    request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, {
      headers: auth,
      data: { status },
    });
  if (opts.paid) {
    await payOrder(request, token, order.id);
  } else {
    await setOrder("PENDING_PAYMENT");
    await setOrder("PAID"); // à la main : `paymentStatus` reste « UNPAID »
  }
  await setOrder("PROCESSING");
  await setOrder("READY_TO_SHIP");
  const shipment = await (
    await request.post(`${apiUrl}/api/v1/shipments`, { headers: auth, data: { orderId: order.id } })
  ).json();
  const setShipment = (status: string) =>
    request.patch(`${apiUrl}/api/v1/shipments/${shipment.id}/status`, {
      headers: auth,
      data: { status },
    });
  expect((await setShipment("SHIPPED")).ok()).toBe(true);

  const readOrder = async () =>
    (await request.get(`${apiUrl}/api/v1/orders/${order.id}`, { headers: auth })).json();
  const readShipment = async () =>
    (await request.get(`${apiUrl}/api/v1/shipments/${shipment.id}`, { headers: auth })).json();
  return { order, setOrder, setShipment, readOrder, readShipment };
}

test("une commande non payée ne peut être livrée ni par son statut, ni par son expédition", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const { setOrder, setShipment, readOrder, readShipment } = await shippedOrder(request, token, {
    paid: false,
  });
  expect((await readOrder()).paymentStatus).toBe("UNPAID");

  const byOrder = await setOrder("DELIVERED");
  expect(byOrder.status()).toBe(400);
  expect((await byOrder.json()).message).toMatch(/non payée/);

  // Par l'expédition : refus avant écriture, l'expédition reste « expédiée ».
  const byShipment = await setShipment("DELIVERED");
  expect(byShipment.status()).toBe(400);
  expect((await byShipment.json()).message).toMatch(/non payée/);
  expect((await readShipment()).status).toBe("SHIPPED");
  expect((await readOrder()).status).toBe("SHIPPED");
});

test("une commande livrée est en lecture seule : ni remboursement, ni bouton, ni dans le tableau", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const { order, setOrder, setShipment, readOrder } = await shippedOrder(request, token, {
    paid: true,
  });
  expect((await setShipment("DELIVERED")).ok()).toBe(true);
  expect((await readOrder()).status).toBe("DELIVERED");

  // L'API refuse tout changement.
  const refund = await setOrder("REFUNDED");
  expect(refund.status()).toBe(400);

  await page.goto("/orders");
  const row = page.locator("tr", { hasText: order.number });
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Rembourser" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: /^Passer à/ })).toHaveCount(0);

  await page.getByRole("button", { name: order.number, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Commande #/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Rembourser" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Passer à/ })).toHaveCount(0);
});

test("la page commandes rappelle l'ordre des statuts, en italique", async ({ page, request }) => {
  await loginAsAdmin(page, request);
  await page.goto("/orders");
  const reminder = page.locator("em", { hasText: "DRAFT → PENDING_PAYMENT → PAID" });
  await expect(reminder).toContainText("SHIPPED → DELIVERED");
  await expect(reminder).not.toContainText("CANCELLED");
  expect(await reminder.evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
});

test("nouvelle commande : les produits archivés sont en fin de liste, en italique, non sélectionnables", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name = `Archivé ${stamp}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `ARCH-${stamp}`, name, price: 1 },
    })
  ).json();
  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });

  await page.goto("/orders");
  await page.getByRole("button", { name: "Nouvelle commande" }).click();
  const select = page
    .getByRole("dialog")
    .locator("label", { hasText: /^Produit/ })
    .locator("select");

  // Les options se rendent après l'ouverture de la modale : attendre la dernière.
  await expect(select.locator("option", { hasText: name })).toHaveCount(1);
  const options = await select.locator("option").evaluateAll((els) =>
    els.map((el) => ({
      text: el.textContent ?? "",
      disabled: (el as HTMLOptionElement).disabled,
      italic: getComputedStyle(el).fontStyle === "italic",
    })),
  );
  const index = options.findIndex((o) => o.text.includes(name));
  expect(index).toBeGreaterThan(0);
  expect(options[index]).toMatchObject({ disabled: true, italic: true });
  expect(options[index].text).toContain("(archivé)");
  // Séparateur juste avant la zone archivée ; rien d'actif après.
  expect(options[index - 1].text).toMatch(/─/);
  expect(options.slice(index - 1).every((o) => o.disabled)).toBe(true);
  // La sélection par défaut est un produit commandable.
  const selected = await select.evaluate(
    (el) => (el as HTMLSelectElement).selectedOptions[0].disabled,
  );
  expect(selected).toBe(false);
});
