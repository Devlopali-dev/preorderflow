import { test, expect, type APIRequestContext } from "@playwright/test";
import { authHeader, getAdminToken, loginAsAdmin } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DAY = 24 * 60 * 60 * 1000;

// Campagne dédiée avec ses dates (ISO) et son statut de départ.
async function campaign(
  request: APIRequestContext,
  token: string,
  label: string,
  dates: { startDate?: Date; endDate?: Date },
  status?: "RECENSEMENT" | "COMMANDES_OUVERTES",
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
  if (status === "RECENSEMENT" || status === "COMMANDES_OUVERTES") await setStatus("RECENSEMENT");
  if (status === "COMMANDES_OUVERTES") await setStatus("COMMANDES_OUVERTES");

  const read = async () =>
    (await request.get(`${apiUrl}/api/v1/campaigns/${created.id}`, { headers: auth })).json();
  const cleanup = async () => {
    await setStatus("ANNULEE");
    await request.patch(`${apiUrl}/api/v1/products/${product.id}/archive`, { headers: auth });
  };
  return { id: created.id as string, name: created.name as string, read, cleanup };
}

const sweep = (request: APIRequestContext, token: string) =>
  request.post(`${apiUrl}/api/v1/campaigns/apply-schedule`, { headers: authHeader(token) });

test("à la date de début, un brouillon ou un recensement passe en commandes ouvertes", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const now = Date.now();
  const draft = await campaign(request, token, "A", { startDate: new Date(now - DAY) });
  const census = await campaign(
    request,
    token,
    "B",
    { startDate: new Date(now - DAY) },
    "RECENSEMENT",
  );
  const future = await campaign(request, token, "C", { startDate: new Date(now + 5 * DAY) });
  const noDates = await campaign(request, token, "D", {});

  const res = await sweep(request, token);
  expect(res.ok()).toBe(true);
  // Le passage peut déjà avoir été fait par le planificateur ou un autre test : on ne
  // vérifie que l'état final des campagnes.
  expect(Array.isArray(await res.json())).toBe(true);

  expect((await draft.read()).status).toBe("COMMANDES_OUVERTES");
  expect((await census.read()).status).toBe("COMMANDES_OUVERTES");
  // Début dans le futur, ou aucune date : rien ne bouge.
  expect((await future.read()).status).toBe("DRAFT");
  expect((await noDates.read()).status).toBe("DRAFT");

  for (const c of [draft, census, future, noDates]) await c.cleanup();
});

test("après la date de fin, la campagne passe en commandes fermées, la fermeture l'emporte", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const now = Date.now();
  const open = await campaign(
    request,
    token,
    "E",
    { startDate: new Date(now - 10 * DAY), endDate: new Date(now - 2 * DAY) },
    "COMMANDES_OUVERTES",
  );
  // Début et fin dépassés dès le brouillon : directement fermée.
  const both = await campaign(request, token, "F", {
    startDate: new Date(now - 10 * DAY),
    endDate: new Date(now - 2 * DAY),
  });
  // Fin dans le futur : reste ouverte.
  const running = await campaign(
    request,
    token,
    "G",
    { startDate: new Date(now - 10 * DAY), endDate: new Date(now + 5 * DAY) },
    "COMMANDES_OUVERTES",
  );

  await sweep(request, token);

  expect((await open.read()).status).toBe("COMMANDES_FERMEES");
  expect((await both.read()).status).toBe("COMMANDES_FERMEES");
  expect((await running.read()).status).toBe("COMMANDES_OUVERTES");

  // Une campagne fermée n'est plus retouchée par un second passage.
  const again = (await (await sweep(request, token)).json()) as Array<{ id: string }>;
  expect(again.find((c) => c.id === open.id)).toBeUndefined();

  for (const c of [open, both, running]) await c.cleanup();
});

test("la date de fin saisie sans heure est incluse : une campagne finissant aujourd'hui reste ouverte", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // « aujourd'hui » tel que l'interface l'enregistre
  const endsToday = await campaign(
    request,
    token,
    "H",
    { startDate: new Date(today.getTime() - 3 * DAY), endDate: today },
    "COMMANDES_OUVERTES",
  );

  await sweep(request, token);
  expect((await endsToday.read()).status).toBe("COMMANDES_OUVERTES");

  await endsToday.cleanup();
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
