import { beforeEach, describe, expect, it, vi } from "vitest";

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
      findUniqueOrThrow: campaignFindUnique,
      updateMany: campaignUpdateMany,
      update: campaignUpdate,
    },
    campaignInterest: { findMany: interestFindMany },
  },
}));

import { BadRequestException } from "@nestjs/common";
import { CampaignService } from "./campaign.service";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Stylo #1",
  slug: "stylo-1",
  status: "RECENSEMENT",
  startDate: new Date("2026-06-01T00:00:00.000Z"),
  endDate: null,
  scheduleOverridden: false,
  ...overrides,
});

describe("CampaignService — statut manuel", () => {
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
    interestFindMany.mockResolvedValue([]);
    campaignUpdateMany.mockResolvedValue({ count: 1 });
    campaignUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      campaign(data),
    );
  });

  const current = (status: string, overrides: Record<string, unknown> = {}) =>
    vi
      .spyOn(service, "getBySlugOrId")
      .mockResolvedValue(campaign({ status, ...overrides }) as never);

  it("refuse un saut ou un retour arrière sans option manuelle", async () => {
    current("COMMANDES_OUVERTES");
    await expect(service.updateStatus("c1", "DRAFT" as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(campaignUpdate).not.toHaveBeenCalled();
  });

  it("manuel : transition libre (retour arrière) et statut verrouillé contre les dates", async () => {
    current("COMMANDES_OUVERTES");
    await service.updateStatus("c1", "DRAFT" as never, { manual: true });
    expect(campaignUpdate.mock.calls[0]![0].data).toEqual({
      status: "DRAFT",
      scheduleOverridden: true,
    });
  });

  it("manuel : saut de plusieurs étapes accepté", async () => {
    current("DRAFT");
    await service.updateStatus("c1", "EXPEDITION" as never, { manual: true });
    expect(campaignUpdate.mock.calls[0]![0].data).toMatchObject({
      status: "EXPEDITION",
      scheduleOverridden: true,
    });
  });

  it("manuel vers « commandes ouvertes » envoie le mail d'ouverture", async () => {
    current("DRAFT");
    interestFindMany.mockResolvedValue([
      {
        email: "a@example.com",
        firstName: "Alice",
        items: [{ quantity: 1, variant: { color: null } }],
      },
    ]);
    await service.updateStatus("c1", "COMMANDES_OUVERTES" as never, { manual: true });
    await service.settleMailings();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("même statut en manuel : verrou posé, aucun mail", async () => {
    current("COMMANDES_OUVERTES");
    await service.updateStatus("c1", "COMMANDES_OUVERTES" as never, { manual: true });
    await service.settleMailings();
    expect(campaignUpdate.mock.calls[0]![0].data.scheduleOverridden).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("le planificateur ignore une campagne verrouillée (filtre de recherche)", async () => {
    campaignFindMany.mockResolvedValue([]);
    await service.applySchedule(NOW);
    expect(campaignFindMany.mock.calls[0]![0].where).toMatchObject({ scheduleOverridden: false });
  });

  it("applyScheduleFor ne touche pas une campagne verrouillée, même dates dépassées", async () => {
    campaignFindUnique.mockResolvedValue(campaign({ status: "DRAFT", scheduleOverridden: true }));
    expect(await service.applyScheduleFor("c1", NOW)).toBeNull();
    expect(campaignUpdateMany).not.toHaveBeenCalled();
  });

  it("applyScheduleFor reste actif sur une campagne non verrouillée", async () => {
    campaignFindUnique.mockResolvedValue(campaign());
    expect(await service.applyScheduleFor("c1", NOW)).toMatchObject({
      to: "COMMANDES_OUVERTES",
    });
    expect(campaignUpdateMany.mock.calls[0]![0].where).toMatchObject({ scheduleOverridden: false });
  });

  it("retour en automatique : verrou levé puis règle des dates réappliquée", async () => {
    current("DRAFT", { scheduleOverridden: true });
    campaignFindUnique.mockResolvedValue(campaign({ status: "DRAFT" }));
    await service.updateStatus("c1", "DRAFT" as never, { auto: true });
    expect(campaignUpdate.mock.calls[0]![0].data).toEqual({
      status: "DRAFT",
      scheduleOverridden: false,
    });
    // dates dépassées + statut DRAFT : le planificateur repasse en « commandes ouvertes »
    expect(campaignUpdateMany.mock.calls[0]![0].data).toEqual({ status: "COMMANDES_OUVERTES" });
  });
});
