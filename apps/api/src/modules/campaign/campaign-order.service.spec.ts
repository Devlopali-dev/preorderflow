import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

// vi.mock est hissé en tête du fichier : le mock doit l'être aussi.
const { findMany, addressCount, addressCreateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  addressCount: vi.fn(),
  addressCreateMany: vi.fn(),
}));
vi.mock("@preorderflow/database", () => ({
  prisma: {
    productVariant: { findMany },
    address: { count: addressCount, createMany: addressCreateMany },
  },
}));

import { CampaignOrderService } from "./campaign-order.service";
import type { CreatePublicOrderDto } from "./dto/create-public-order.dto";

const VARIANT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_B = "22222222-2222-4222-8222-222222222222";

function dto(overrides: Partial<CreatePublicOrderDto> = {}): CreatePublicOrderDto {
  return {
    email: "acheteur@example.com",
    firstName: "Alice",
    lastName: "Martin",
    phone: "0600000000",
    items: [{ variantId: VARIANT_A, quantity: 2 }],
    shippingAddress: { address1: "1 rue", postalCode: "75000", city: "Paris", country: "FR" },
    ...overrides,
  };
}

describe("CampaignOrderService — commande publique", () => {
  const getVisibleBySlugOrId = vi.fn();
  const create = vi.fn();
  const createForOrder = vi.fn();
  const service = new CampaignOrderService(
    { getVisibleBySlugOrId } as never,
    { create } as never,
    { createForOrder } as never,
  );

  beforeEach(() => {
    for (const mock of [
      findMany,
      getVisibleBySlugOrId,
      create,
      createForOrder,
      addressCount,
      addressCreateMany,
    ])
      mock.mockReset();
    addressCount.mockResolvedValue(0);
    getVisibleBySlugOrId.mockResolvedValue({
      id: "c1",
      productId: "p1",
      status: "COMMANDES_OUVERTES",
    });
    findMany.mockResolvedValue([{ id: VARIANT_A }]);
    create.mockResolvedValue({
      id: "o1",
      customerId: "cust1",
      number: "2026-0042",
      currency: "EUR",
      total: { toFixed: (digits: number) => (6).toFixed(digits) },
    });
    createForOrder.mockResolvedValue({
      metadata: { paymentLink: "https://revolut.me/x?currency=EUR&amount=600" },
    });
  });

  it("crée la commande liée à la campagne puis son règlement manuel, et renvoie le lien", async () => {
    const result = await service.create("c1", dto());

    expect(create).toHaveBeenCalledTimes(1);
    const [orderDto, options] = create.mock.calls[0]!;
    expect(orderDto).toMatchObject({
      customerEmail: "acheteur@example.com",
      campaignId: "c1",
      items: [{ variantId: VARIANT_A, quantity: 2 }],
      shippingAddress: { firstName: "Alice", lastName: "Martin", city: "Paris" },
    });
    // Un formulaire anonyme ne réécrit jamais un client existant.
    expect(options).toEqual({ keepExistingCustomer: true });
    expect(createForOrder).toHaveBeenCalledWith("o1", { provider: "MANUAL" });
    expect(result).toEqual({
      orderNumber: "2026-0042",
      total: "6.00",
      currency: "EUR",
      paymentLink: "https://revolut.me/x?currency=EUR&amount=600",
    });
  });

  it("enregistre l'adresse dans le carnet du client, sans toucher à un client qui en a déjà une", async () => {
    await service.create("c1", dto());
    expect(addressCreateMany).toHaveBeenCalledTimes(1);
    const rows = addressCreateMany.mock.calls[0]![0].data as Array<{
      customerId: string;
      city: string;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.customerId === "cust1" && r.city === "Paris")).toBe(true);

    addressCreateMany.mockReset();
    addressCount.mockResolvedValue(2); // carnet déjà rempli
    await service.create("c1", dto());
    expect(addressCreateMany).not.toHaveBeenCalled();
  });

  it("renvoie null quand aucun lien de paiement n'est configuré", async () => {
    createForOrder.mockResolvedValue({ metadata: null });
    expect((await service.create("c1", dto())) as { paymentLink: string | null }).toMatchObject({
      paymentLink: null,
    });
  });

  it("refuse tant que les commandes ne sont pas ouvertes (recensement, fermées, archivées…)", async () => {
    for (const status of [
      "DRAFT",
      "RECENSEMENT",
      "COMMANDES_FERMEES",
      "PRODUCTION",
      "TERMINEE",
      "ANNULEE",
    ]) {
      getVisibleBySlugOrId.mockResolvedValue({ id: "c1", productId: "p1", status });
      await expect(service.create("c1", dto())).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("refuse une variante qui n'est pas celle du produit de la campagne, ou une couleur en double", async () => {
    findMany.mockResolvedValue([]); // aucune variante active de ce produit
    await expect(service.create("c1", dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany.mock.calls[0]![0].where).toMatchObject({ productId: "p1", active: true });

    await expect(
      service.create(
        "c1",
        dto({
          items: [
            { variantId: VARIANT_A, quantity: 1 },
            { variantId: VARIANT_A, quantity: 1 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    findMany.mockResolvedValue([{ id: VARIANT_A }]); // une seule des deux variantes existe
    await expect(
      service.create(
        "c1",
        dto({
          items: [
            { variantId: VARIANT_A, quantity: 1 },
            { variantId: VARIANT_B, quantity: 1 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("honeypot rempli : répond sans rien créer ni même lire la campagne", async () => {
    const result = await service.create("c1", dto({ website: "http://spam.example" }));
    expect(result).toEqual({ ignored: true });
    expect(getVisibleBySlugOrId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(createForOrder).not.toHaveBeenCalled();
  });
});
