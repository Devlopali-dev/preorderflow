import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DAY = 24 * 60 * 60 * 1000;

// Les dates d'une campagne font passer son statut (commandes ouvertes dès le début, fermées après la
// fin) dès l'enregistrement, sans attendre le planificateur, qui rattrape ensuite le passage du temps.
async function campaign(
  request: APIRequestContext,
  token: string,
  label: string,
  dates: { startDate?: Date; endDate?: Date } = {},
) {
  const auth = authHeader(token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const product = await (
    await request.post(`${apiUrl}/api/v1/products`, {
      headers: auth,
      data: { sku: `SCH-${label}-${stamp}`, name: `Planifiée ${label} ${stamp}`, price: 1 },
    })
  ).json();
  const created = await (
    await request.post(`${apiUrl}/api/v1/campaigns`, {
      headers: auth,
      data: {
        name: `Campagne ${label} ${stamp}`,
        slug: `sch-${label.toLowerCase()}-${stamp}`,
        productId: product.id,
        startDate: dates.startDate?.toISOString(),
        endDate: dates.endDate?.toISOString(),
      },
    })
  ).json();
  const setStatus = (to: string) =>
    request.patch(`${apiUrl}/api/v1/campaigns/${created.id}/status`, {
      headers: auth,
      data: { status: to },
    });
  const patch = async (data: Record<string, unknown>) =>
    (
      await request.patch(`${apiUrl}/api/v1/campaigns/${created.id}`, { headers: auth, data })
    ).json();
  const read = async () =>
    (await request.get(`${apiUrl}/api/v1/campaigns/${created.id}`, { headers: auth })).json();
  const cleanup = async () => {
    await setStatus("ANNULEE");
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { created, setStatus, patch, read, cleanup };
}

const sweep = (request: APIRequestContext, token: string) =>
  request.post(`${apiUrl}/api/v1/campaigns/apply-schedule`, { headers: authHeader(token) });

test("à l'enregistrement des dates, un brouillon ou un recensement passe en commandes ouvertes dès le début", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const now = Date.now();

  // Début déjà passé dès la création : ouverte tout de suite.
  const draft = await campaign(request, token, "A", { startDate: new Date(now - DAY) });
  expect(draft.created.status).toBe("COMMANDES_OUVERTES");

  // En recensement avec un début à venir, puis la date est avancée : le statut suit dans la réponse.
  const census = await campaign(request, token, "B", { startDate: new Date(now + 5 * DAY) });
  await census.setStatus("RECENSEMENT");
  const moved = await census.patch({ startDate: new Date(now - DAY).toISOString() });
  expect(moved.status).toBe("COMMANDES_OUVERTES");
  expect((await census.read()).status).toBe("COMMANDES_OUVERTES");

  // Début à venir, ou aucune date : rien ne bouge.
  const future = await campaign(request, token, "C", { startDate: new Date(now + 5 * DAY) });
  const noDates = await campaign(request, token, "D");
  expect(future.created.status).toBe("DRAFT");
  expect(noDates.created.status).toBe("DRAFT");

  for (const c of [draft, census, future, noDates]) await c.cleanup();
});

test("après la date de fin, la campagne passe en commandes fermées, la fermeture l'emporte", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const now = Date.now();

  // Aux commandes ouvertes, puis la fin est ramenée dans le passé.
  const open = await campaign(request, token, "E", { startDate: new Date(now + 3 * DAY) });
  await open.setStatus("RECENSEMENT");
  await open.setStatus("COMMANDES_OUVERTES");
  expect((await open.read()).status).toBe("COMMANDES_OUVERTES");
  const closed = await open.patch({
    startDate: new Date(now - 10 * DAY).toISOString(),
    endDate: new Date(now - 2 * DAY).toISOString(),
  });
  expect(closed.status).toBe("COMMANDES_FERMEES");

  // Début et fin dépassés dès la création : directement fermée.
  const both = await campaign(request, token, "F", {
    startDate: new Date(now - 10 * DAY),
    endDate: new Date(now - 2 * DAY),
  });
  expect(both.created.status).toBe("COMMANDES_FERMEES");

  // Fin à venir : reste ouverte.
  const running = await campaign(request, token, "G", {
    startDate: new Date(now - 10 * DAY),
    endDate: new Date(now + 5 * DAY),
  });
  expect(running.created.status).toBe("COMMANDES_OUVERTES");

  // Un second passage ne retouche pas une campagne déjà fermée.
  const again = (await (await sweep(request, token)).json()) as Array<{ id: string }>;
  expect(again.find((c) => c.id === open.created.id)).toBeUndefined();

  for (const c of [open, both, running]) await c.cleanup();
});

test("repousser la fin d'une campagne déjà fermée ne la rouvre pas", async ({ request }) => {
  const token = await getAdminToken(request);
  const now = Date.now();
  const closed = await campaign(request, token, "R", {
    startDate: new Date(now - 10 * DAY),
    endDate: new Date(now - 2 * DAY),
  });
  expect(closed.created.status).toBe("COMMANDES_FERMEES");

  // La machine d'états interdit le retour en arrière : les nouvelles dates ne rouvrent rien.
  const moved = await closed.patch({ endDate: new Date(now + 10 * DAY).toISOString() });
  expect(moved.status).toBe("COMMANDES_FERMEES");
  expect((await closed.read()).status).toBe("COMMANDES_FERMEES");

  await closed.cleanup();
});

test("la date de fin saisie sans heure est incluse : une campagne finissant aujourd'hui reste ouverte", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // « aujourd'hui » tel que l'interface l'enregistre
  const endsToday = await campaign(request, token, "H", {
    startDate: new Date(today.getTime() + 5 * DAY),
  });
  await endsToday.setStatus("RECENSEMENT");
  await endsToday.setStatus("COMMANDES_OUVERTES");

  const updated = await endsToday.patch({
    startDate: new Date(today.getTime() - 3 * DAY).toISOString(),
    endDate: today.toISOString(),
  });
  expect(updated.status).toBe("COMMANDES_OUVERTES");
  await sweep(request, token);
  expect((await endsToday.read()).status).toBe("COMMANDES_OUVERTES");

  await endsToday.cleanup();
});

test("le planificateur rattrape le passage du temps : une date de début qui arrive fait ouvrir la campagne", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  // Début dans 3 secondes : au moment de l'enregistrement la campagne reste en brouillon.
  const soon = await campaign(request, token, "T", { startDate: new Date(Date.now() + 3000) });
  expect(soon.created.status).toBe("DRAFT");

  await new Promise((resolve) => setTimeout(resolve, 3500));
  const res = await sweep(request, token);
  expect(res.ok()).toBe(true);
  expect((await soon.read()).status).toBe("COMMANDES_OUVERTES");

  await soon.cleanup();
});

test("le passage automatique est réservé aux administrateurs", async ({ request }) => {
  const anonymous = await request.post(`${apiUrl}/api/v1/campaigns/apply-schedule`);
  expect(anonymous.status()).toBe(401);
});

test("la modale d'une campagne indique le passage automatique selon les dates", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page, request);
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nouvelle campagne" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/passe automatiquement à « commandes ouvertes » à la date de début/),
  ).toBeVisible();
});

test("la modale d'une campagne fermée prévient que de nouvelles dates ne la rouvrent pas", async ({
  page,
  request,
}) => {
  const token = await loginAsAdmin(page, request);
  const now = Date.now();
  const closed = await campaign(request, token, "W", {
    startDate: new Date(now - 10 * DAY),
    endDate: new Date(now - 2 * DAY),
  });
  expect(closed.created.status).toBe("COMMANDES_FERMEES");

  await page.goto("/campaigns");
  await page.getByRole("button", { name: closed.created.name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  // Fin dans le passé : pas d'avertissement. Fin dans le futur : on prévient.
  await expect(dialog.getByText(/ne la rouvrent pas/)).toHaveCount(0);
  await dialog
    .getByLabel("Fin (deadline)")
    .fill(new Date(now + 10 * DAY).toISOString().slice(0, 10));
  await expect(dialog.getByText(/de nouvelles dates ne la rouvrent pas/)).toBeVisible();

  await closed.cleanup();
});
