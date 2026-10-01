import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock est hissé en tête du fichier : les mocks doivent l'être aussi.
const {
  campaignFindMany,
  campaignFindUnique,
  campaignUpdateMany,
  campaignUpdate,
  interestFindMany,
} = vi.hoisted(() => ({
  campaignFindMany: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignUpdateMany: vi.fn(),
  campaignUpdate: vi.fn(),
  interestFindMany: vi.fn(),
}));
vi.mock("@preorderflow/database", () => ({
  prisma: {
    campaign: {
      findMany: campaignFindMany,
      findUnique: campaignFindUnique,
      updateMany: campaignUpdateMany,
      update: campaignUpdate,
    },
    campaignInterest: { findMany: interestFindMany },
  },
}));

import { CampaignService } from "./campaign.service";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Stylo #1",
  slug: "stylo-1",
  status: "RECENSEMENT",
  startDate: new Date("2026-06-01T00:00:00.000Z"),
  endDate: null,
  ...overrides,
});

describe("CampaignService — ouverture des commandes", () => {
  const sendEmail = vi.fn();
  const notifyAdmin = vi.fn();
  const service = new CampaignService({ sendEmail, notifyAdmin } as never);

  beforeEach(() => {
    for (const mock of [
      campaignFindMany,
      campaignFindUnique,
      campaignUpdateMany,
      campaignUpdate,
      interestFindMany,
      sendEmail,
      notifyAdmin,
    ]) {
      mock.mockReset();
    }
    notifyAdmin.mockResolvedValue(undefined);
    sendEmail.mockResolvedValue(undefined);
    // 1er updateMany : passage de statut ; 2e : marqueur d'envoi (posé avant les mails).
    campaignUpdateMany.mockResolvedValue({ count: 1 });
  });

  const interest = (email: string, firstName: string, quantity: number, color: string | null) => ({
    email,
    firstName,
    items: [{ quantity, variant: { color: color ? { name: color } : null } }],
  });

  it("à l'ouverture par les dates, un mail par adresse distincte avec le récapitulatif et le lien", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    interestFindMany.mockResolvedValue([
      interest("a@example.com", "Alice", 2, "Rouge"),
      interest("A@example.com", "Alice", 1, "Bleu"),
      interest("b@example.com", "Bob", 3, null),
    ]);

    const change = await service.applyScheduleFor("c1", NOW);
    await service.settleMailings();

    expect(change).toMatchObject({ from: "RECENSEMENT", to: "COMMANDES_OUVERTES" });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const [to, template, payload] = sendEmail.mock.calls[0]!;
    expect(to).toBe("a@example.com");
    expect(template).toBe("ORDERS_OPENED");
    expect(payload).toMatchObject({
      firstName: "Alice",
      campaignName: "Stylo #1",
      quantity: 3,
      details: " (2 × Rouge, 1 × Bleu)",
    });
    expect(payload.campaignUrl).toMatch(/\/campaigns\/stylo-1$/);
  });

  it("n'écrit qu'aux personnes qui ont consenti à être recontactées", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    interestFindMany.mockResolvedValue([]);
    await service.applyScheduleFor("c1", NOW);
    await service.settleMailings();
    expect(interestFindMany.mock.calls[0]![0].where).toEqual({
      campaignId: "c1",
      consentToContact: true,
    });
  });

  it("ne renvoie jamais le mail : le marqueur d'envoi déjà posé arrête tout", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    // passage de statut accepté, mais marqueur déjà posé
    campaignUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await service.applyScheduleFor("c1", NOW);
    await service.settleMailings();
    expect(interestFindMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("le marqueur est posé avant les envois, de façon conditionnelle", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    interestFindMany.mockResolvedValue([interest("a@example.com", "Alice", 1, null)]);
    await service.applyScheduleFor("c1", NOW);
    await service.settleMailings();
    const claim = campaignUpdateMany.mock.calls[1]![0];
    expect(claim.where).toEqual({ id: "c1", ordersOpenedMailedAt: null });
    expect(claim.data.ordersOpenedMailedAt).toBeInstanceOf(Date);
  });

  it("pas de mail pour une fermeture, ni quand la campagne est déjà dans le bon état", async () => {
    campaignFindUnique.mockResolvedValue(
      campaign({ status: "COMMANDES_OUVERTES", endDate: new Date("2026-06-10T00:00:00.000Z") }),
    );
    expect(await service.applyScheduleFor("c1", NOW)).toMatchObject({ to: "COMMANDES_FERMEES" });
    await service.settleMailings();
    expect(sendEmail).not.toHaveBeenCalled();

    campaignFindUnique.mockResolvedValue(campaign({ status: "COMMANDES_OUVERTES" }));
    expect(await service.applyScheduleFor("c1", NOW)).toBeNull();
  });

  it("l'ouverture manuelle (bouton) envoie aussi le mail", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    // getBySlugOrId passe par findFirst : on l'espionne sur le service.
    vi.spyOn(service, "getBySlugOrId").mockResolvedValue(
      campaign({ status: "RECENSEMENT" }) as never,
    );
    campaignUpdate.mockResolvedValue(campaign({ status: "COMMANDES_OUVERTES" }));
    interestFindMany.mockResolvedValue([interest("a@example.com", "Alice", 1, null)]);

    await service.updateStatus("c1", "COMMANDES_OUVERTES");
    await service.settleMailings();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("une erreur d'envoi ne fait jamais échouer le changement de statut", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    interestFindMany.mockRejectedValue(new Error("base indisponible"));
    await expect(service.applyScheduleFor("c1", NOW)).resolves.toMatchObject({
      to: "COMMANDES_OUVERTES",
    });
    await expect(service.settleMailings()).resolves.toBeUndefined();
  });
});
