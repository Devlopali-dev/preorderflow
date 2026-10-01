import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, isStableColor } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Variant {
  id: string;
  sku: string;
  active: boolean;
  colorId: string | null;
  color: { name: string } | null;
}

// Produit dédié + deux couleurs actives de la palette, quelles qu'elles soient :
// aucun de ces tests ne dépend de l'état des données du seed.
async function setup(request: APIRequestContext, label: string) {
  const auth = authHeader(await getAdminToken(request));
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const colors = (await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json())
    .filter(isStableColor)
    .slice(0, 2) as Array<{ id: string; name: string }>;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `${label}-${stamp}`, name: `${label} ${stamp}`, price: 1 },
    })
  ).json();

  const variantsOf = async (): Promise<Variant[]> =>
    (await (await request.get(`${apiUrl}/api/v1/products/${product.id}`, { headers: auth })).json())
      .variants;
  const addColor = (colorId: string) =>
    request.post(`${apiUrl}/api/v1/products/${product.id}/variants`, {
      headers: auth,
      data: { colorId },
    });
  const setActive = (variantId: string, active: boolean) =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/variants/${variantId}`, {
      headers: auth,
      data: { active },
    });
  const archive = () =>
    request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });

  return { auth, colors, product, variantsOf, addColor, setActive, archive, stamp };
}

test("désactiver une couleur inutilisée la retire, et le produit retombe sur Standard", async ({
  request,
}) => {
  const { colors, product, variantsOf, addColor, setActive, archive } = await setup(
    request,
    "VAR-A",
  );

  // Un produit neuf n'a que la variante Standard.
  let variants = await variantsOf();
  expect(variants).toHaveLength(1);
  expect(variants[0].color).toBeNull();
  expect(variants[0].sku).toBe(product.sku);

  // Ajouter une couleur retire le Standard inutilisé.
  expect((await addColor(colors[0].id)).status()).toBe(201);
  variants = await variantsOf();
  expect(variants.map((v) => v.color?.name)).toEqual([colors[0].name]);

  // La retirer (aucun historique) la supprime vraiment…
  const removal = await setActive(variants[0].id, false);
  expect(removal.status()).toBe(200);
  expect((await removal.json()).removed).toBe(true);

  // …et « pas de couleur = Standard » : la variante par défaut est recréée, active.
  variants = await variantsOf();
  expect(variants).toHaveLength(1);
  expect(variants[0].color).toBeNull();
  expect(variants[0].active).toBe(true);

  // Le Standard ne se désactive jamais.
  const standard = await setActive(variants[0].id, false);
  expect(standard.status()).toBe(400);
  expect((await standard.json()).message).toMatch(/Standard/);

  await archive();
});

test("une couleur avec du stock reste en inactive au lieu d'être retirée", async ({ request }) => {
  const { auth, colors, variantsOf, addColor, setActive, archive } = await setup(request, "VAR-B");

  await addColor(colors[0].id);
  await addColor(colors[1].id);
  const [first, second] = await variantsOf();

  // Du stock sur la première couleur : un lot terminé crée le mouvement.
  const batch = await (
    await request.post(`${apiUrl}/api/v1/production/batches`, {
      headers: auth,
      data: { items: [{ variantId: first.id, quantityPlanned: 5 }] },
    })
  ).json();
  await request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/start`, { headers: auth });
  const completed = await request.post(`${apiUrl}/api/v1/production/batches/${batch.id}/complete`, {
    headers: auth,
    data: { items: [{ productionItemId: batch.items[0].id, quantityProduced: 5 }] },
  });
  expect(completed.ok()).toBe(true);

  // Retirer la couleur qui a du stock : elle reste, inactive.
  const kept = await setActive(first.id, false);
  const keptBody = await kept.json();
  expect(keptBody.removed).toBe(false);
  expect(keptBody.variant.active).toBe(false);
  let variants = await variantsOf();
  expect(variants.find((v) => v.id === first.id)?.active).toBe(false);

  // Retirer la seconde (sans historique) : elle disparaît, et comme plus aucune
  // variante n'est active, le Standard est créé pour prendre le relais.
  const removed = await setActive(second.id, false);
  expect((await removed.json()).removed).toBe(true);
  variants = await variantsOf();
  expect(variants.find((v) => v.id === second.id)).toBeUndefined();
  const standard = variants.find((v) => v.color === null);
  expect(standard?.active).toBe(true);

  // On peut réactiver la couleur mise de côté.
  const reactivated = await setActive(first.id, true);
  expect((await reactivated.json()).variant.active).toBe(true);

  await archive();
});

test("le slug d'un produit est généré depuis le nom et reste unique", async ({ request }) => {
  const auth = authHeader(await getAdminToken(request));
  const name = `Slug Auto ${Date.now()}`;

  const create = () =>
    request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `SLUG-${Math.random().toString(36).slice(2, 10)}`, name, price: 1 },
    });

  const first = await (await create()).json();
  const second = await (await create()).json();

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  expect(first.slug).toBe(base);
  expect(second.slug).toBe(`${base}-2`);

  for (const product of [first, second]) {
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  }
});
