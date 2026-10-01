import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";

// vi.mock est hissé en tête du fichier : le mock doit l'être aussi.
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@preorderflow/database", () => ({ prisma: { order: { findFirst } } }));

import { CustomerPortalService } from "./customer-portal.service";

const total = { toFixed: (digits: number) => (3).toFixed(digits) };

function order(overrides: Record<string, unknown> = {}) {
  return { id: "o1", number: "2026-0001", status: "DRAFT", total, payments: [], ...overrides };
}

describe("CustomerPortalService — choix du paiement", () => {
  const createForOrder = vi.fn();
  const notifyAdmin = vi.fn();
  const service = new CustomerPortalService({ createForOrder } as never, { notifyAdmin } as never);

  beforeEach(() => {
    findFirst.mockReset();
    createForOrder.mockReset();
    notifyAdmin.mockReset();
  });

  it("payer maintenant : génère le règlement manuel, renvoie montant et lien, prévient l'admin", async () => {
    findFirst.mockResolvedValue(order());
    createForOrder.mockResolvedValue({
      amount: "3.00",
      metadata: { paymentLink: "https://revolut.me/x?currency=EUR&amount=300" },
    });

    const result = await service.payNow("c1", "o1");

    expect(createForOrder).toHaveBeenCalledWith("o1", { provider: "MANUAL" });
    expect(result).toEqual({
      amount: "3.00",
      paymentLink: "https://revolut.me/x?currency=EUR&amount=300",
    });
    expect(notifyAdmin).toHaveBeenCalledTimes(1);
  });

  it("payer maintenant : renvoie null quand aucun lien n'est configuré", async () => {
    findFirst.mockResolvedValue(order());
    createForOrder.mockResolvedValue({ amount: "3.00", metadata: null });
    expect((await service.payNow("c1", "o1")).paymentLink).toBeNull();
  });

  it("payer maintenant est rejouable : un règlement manuel en attente est réutilisé, sans doublon", async () => {
    findFirst.mockResolvedValue(
      order({
        status: "PENDING_PAYMENT",
        payments: [
          {
            provider: "MANUAL",
            status: "PENDING",
            amount: "3.00",
            metadata: { paymentLink: "https://revolut.me/x?amount=300" },
          },
        ],
      }),
    );

    const result = await service.payNow("c1", "o1");

    expect(createForOrder).not.toHaveBeenCalled();
    expect(notifyAdmin).not.toHaveBeenCalled();
    expect(result.paymentLink).toBe("https://revolut.me/x?amount=300");
  });

  it("plus tard : ne génère aucun règlement et prévient l'admin", async () => {
    findFirst.mockResolvedValue(order());
    expect(await service.payLater("c1", "o1")).toEqual({ ok: true });
    expect(createForOrder).not.toHaveBeenCalled();
    expect(notifyAdmin).toHaveBeenCalledTimes(1);
  });

  it("refuse une commande déjà réglée ou annulée (400), sans rien générer", async () => {
    for (const status of ["PAID", "PROCESSING", "CANCELLED"]) {
      findFirst.mockResolvedValue(order({ status }));
      await expect(service.payNow("c1", "o1")).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.payLater("c1", "o1")).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(createForOrder).not.toHaveBeenCalled();
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("une commande d'un autre client reste introuvable (404), jamais interdite", async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.payNow("autre", "o1")).rejects.toBeInstanceOf(NotFoundException);
    // Le filtre porte bien sur le client du token, pas seulement sur l'id de la commande.
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: "o1", customerId: "autre" });
  });
});
