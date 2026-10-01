import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock est hissé en tête du fichier : les mocks doivent l'être aussi.
const { count, createMany, findMany, update, create } = vi.hoisted(() => ({
  count: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@preorderflow/database", () => ({
  prisma: { address: { count, createMany, findMany, update, create } },
}));

import { addressRow, saveAddressIfNone, saveShippingAddress } from "./address-book";

const source = {
  firstName: " Alice ",
  lastName: "Martin",
  phone: "0600000000",
  address1: " 12 rue des Lilas ",
  address2: "  ",
  postalCode: "69001",
  city: "Lyon",
  country: "fr",
};

describe("address-book", () => {
  beforeEach(() => {
    for (const mock of [count, createMany, findMany, update, create]) mock.mockReset();
  });

  it("addressRow nettoie la saisie : espaces retirés, vides à null, pays en majuscules", () => {
    expect(addressRow("c1", "SHIPPING", source)).toEqual({
      customerId: "c1",
      type: "SHIPPING",
      firstName: "Alice",
      lastName: "Martin",
      company: null,
      address1: "12 rue des Lilas",
      address2: null,
      postalCode: "69001",
      city: "Lyon",
      country: "FR",
      phone: "0600000000",
    });
  });

  it("commande anonyme : crée les adresses de facturation et de livraison d'un client qui n'en a aucune", async () => {
    count.mockResolvedValue(0);
    expect(await saveAddressIfNone("c1", source)).toBe(true);
    const rows = createMany.mock.calls[0]![0].data as Array<{ type: string; customerId: string }>;
    expect(rows.map((r) => r.type).sort()).toEqual(["BILLING", "SHIPPING"]);
    expect(rows.every((r) => r.customerId === "c1")).toBe(true);
  });

  it("commande anonyme : un client qui a déjà un carnet n'est jamais modifié", async () => {
    count.mockResolvedValue(1);
    expect(await saveAddressIfNone("c1", source)).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("profil : met à jour l'adresse de livraison existante, sans toucher à la facturation", async () => {
    findMany.mockResolvedValue([
      { id: "s1", type: "SHIPPING" },
      { id: "b1", type: "BILLING" },
    ]);
    await saveShippingAddress("c1", source);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].where).toEqual({ id: "s1" });
    // Le type et le client ne sont jamais réécrits.
    expect(update.mock.calls[0]![0].data).not.toHaveProperty("type");
    expect(update.mock.calls[0]![0].data).not.toHaveProperty("customerId");
    expect(create).not.toHaveBeenCalled();
  });

  it("profil : crée la livraison puis une facturation identique quand le carnet est vide", async () => {
    findMany.mockResolvedValue([]);
    await saveShippingAddress("c1", source);
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls.map((c) => c[0].data.type)).toEqual(["SHIPPING", "BILLING"]);
  });
});
