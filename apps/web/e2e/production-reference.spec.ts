import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Un produit dédié par run : la référence dépend du nom du produit, donc les
// lots des autres tests (ou d'un run précédent le même jour) ne la perturbent pas.
test("la référence d'un lot est générée nom-AAAAMMJJ, avec #1, #2 en cas de doublon", async ({
  request,
}) => {
  const auth = authHeader(await getAdminToken(request));
  const stamp = Date.now();

  const productRes = await request.post(`${apiUrl}/api/v1/products`, {
    headers: auth,
    data: {
      sku: `REF-${stamp}`,
      name: `Réf Auto ${stamp}`,
      slug: `ref-auto-${stamp}`,
      price: 1,
    },
  });
  expect(productRes.ok()).toBe(true);
  const product = await productRes.json();
  const variantId = product.variants[0].id;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const base = `ref-auto-${stamp}-${today}`;

  async function createBatch(reference?: string) {
    return request.post(`${apiUrl}/api/v1/production/batches`, {
      headers: auth,
      data: { reference, items: [{ variantId, quantityPlanned: 5 }] },
    });
  }

  const first = await createBatch();
  expect(first.status()).toBe(201);
  expect((await first.json()).reference).toBe(base);

  const second = await createBatch();
  expect((await second.json()).reference).toBe(`${base}#1`);

  const third = await createBatch();
  expect((await third.json()).reference).toBe(`${base}#2`);

  // Une référence saisie à la main reste possible, mais unique.
  const manual = await createBatch(`manuel-${stamp}`);
  expect(manual.status()).toBe(201);
  expect((await manual.json()).reference).toBe(`manuel-${stamp}`);
  const duplicate = await createBatch(`manuel-${stamp}`);
  expect(duplicate.status()).toBe(400);

  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
});

test("des lots créés en même temps reçoivent chacun une référence différente", async ({
  request,
}) => {
  const auth = authHeader(await getAdminToken(request));
  const stamp = Date.now();

  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: {
        sku: `PAR-${stamp}`,
        name: `Parallèle ${stamp}`,
        slug: `parallele-${stamp}`,
        price: 1,
      },
    })
  ).json();

  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.post(`${apiUrl}/api/v1/production/batches`, {
        headers: auth,
        data: { items: [{ variantId: product.variants[0].id, quantityPlanned: 1 }] },
      }),
    ),
  );

  expect(responses.map((r) => r.status())).toEqual([201, 201, 201, 201, 201]);
  const references = (await Promise.all(responses.map((r) => r.json()))).map(
    (batch: { reference: string }) => batch.reference,
  );
  expect(new Set(references).size).toBe(5);

  await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
});
