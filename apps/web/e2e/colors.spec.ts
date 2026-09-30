import { test, expect } from "@playwright/test";
import { authHeader, getAdminToken } from "./helpers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

test("une couleur inutilisée se supprime", async ({ request }) => {
  const auth = authHeader(await getAdminToken(request));
  const name = `Test-${Date.now()}`;

  const created = await request.post(`${apiUrl}/api/v1/colors`, {
    headers: auth,
    data: { name, hex: "#123456" },
  });
  expect(created.status()).toBe(201);
  const color = await created.json();

  const deleted = await request.delete(`${apiUrl}/api/v1/colors/${color.id}`, { headers: auth });
  expect(deleted.status()).toBe(200);

  const list = await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json();
  expect(list.some((c: { id: string }) => c.id === color.id)).toBe(false);

  const again = await request.delete(`${apiUrl}/api/v1/colors/${color.id}`, { headers: auth });
  expect(again.status()).toBe(404);
});

test("une couleur utilisée par une variante ne peut pas être supprimée", async ({ request }) => {
  const auth = authHeader(await getAdminToken(request));

  // « Rouge » porte des variantes de stylo dans le seed.
  const list = await (await request.get(`${apiUrl}/api/v1/colors`, { headers: auth })).json();
  const rouge = list.find((c: { name: string }) => c.name === "Rouge");

  const res = await request.delete(`${apiUrl}/api/v1/colors/${rouge.id}`, { headers: auth });
  expect(res.status()).toBe(400);
  expect((await res.json()).message).toMatch(/désactivez-la/);
});

test("un opérateur ne peut pas supprimer une couleur", async ({ request }) => {
  const login = await request.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: "operateur1@preorderflow.dev", password: "password123" },
  });
  const { accessToken } = await login.json();
  const adminAuth = authHeader(await getAdminToken(request));

  const list = await (await request.get(`${apiUrl}/api/v1/colors`, { headers: adminAuth })).json();
  const res = await request.delete(`${apiUrl}/api/v1/colors/${list[0].id}`, {
    headers: authHeader(accessToken),
  });
  expect(res.status()).toBe(403);
});
