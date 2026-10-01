import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";

// vi.mock est hissé en tête du fichier : les mocks doivent l'être aussi.
const { findFirst, findMany } = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));
vi.mock("@preorderflow/database", () => ({
  prisma: { campaign: { findFirst, findMany } },
}));

import { CampaignService } from "./campaign.service";

// Un brouillon est invisible du public : introuvable (404) pour un visiteur, jamais « interdit »
// (on ne confirme pas son existence). Seul un administrateur connecté le voit.
describe("CampaignService — visibilité des brouillons", () => {
  const service = new CampaignService({ notifyAdmin: vi.fn() } as never);

  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  const campaignWith = (status: string) => ({ id: "c1", slug: "c", status, media: [] });

  it("un visiteur ne peut pas lire un brouillon (404), un administrateur si", async () => {
    findFirst.mockResolvedValue(campaignWith("DRAFT"));
    await expect(service.getVisibleBySlugOrId("c")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getVisibleBySlugOrId("c", true)).resolves.toMatchObject({
      status: "DRAFT",
    });
  });

  it("toute campagne non brouillon reste publique", async () => {
    for (const status of [
      "RECENSEMENT",
      "COMMANDES_OUVERTES",
      "COMMANDES_FERMEES",
      "PRODUCTION",
      "EXPEDITION",
      "TERMINEE",
      "ANNULEE",
    ]) {
      findFirst.mockResolvedValue(campaignWith(status));
      await expect(service.getVisibleBySlugOrId("c")).resolves.toMatchObject({ status });
    }
  });

  it("la liste publique exclut les brouillons, celle d'un administrateur les inclut", async () => {
    await service.list();
    expect(findMany.mock.calls[0]![0].where).toEqual({ status: { not: "DRAFT" } });
    await service.list(true);
    expect(findMany.mock.calls[1]![0].where).toBeUndefined();
  });

  it("les statistiques d'un brouillon sont aussi masquées au public", async () => {
    findFirst.mockResolvedValue(campaignWith("DRAFT"));
    await expect(service.getStatistics("c")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("le recensement public d'un brouillon est refusé (404) sans rien créer", async () => {
    findFirst.mockResolvedValue(campaignWith("DRAFT"));
    await expect(
      service.registerInterest("c", {
        email: "a@example.com",
        firstName: "A",
        lastName: "B",
        consentToContact: true,
        items: [{ variantId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
