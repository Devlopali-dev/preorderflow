import { describe, expect, it } from "vitest";
import { assertValidCampaignTransition } from "./campaign-status";
import { automaticTargetStatus, closingInstant } from "./campaign-schedule";

const d = (iso: string) => new Date(iso);
const NOW = d("2026-06-15T12:00:00.000Z");

describe("automaticTargetStatus — ouverture", () => {
  it("ouvre une campagne en brouillon ou en recensement dès la date de début", () => {
    for (const status of ["DRAFT", "RECENSEMENT"] as const) {
      expect(
        automaticTargetStatus({ status, startDate: d("2026-06-15"), endDate: null }, NOW),
      ).toBe("COMMANDES_OUVERTES");
    }
  });

  it("ouvre pile à l'instant de début (now >= début)", () => {
    expect(
      automaticTargetStatus(
        { status: "DRAFT", startDate: d("2026-06-15T12:00:00.000Z"), endDate: null },
        NOW,
      ),
    ).toBe("COMMANDES_OUVERTES");
  });

  it("n'ouvre pas avant la date de début, ni sans date de début", () => {
    expect(
      automaticTargetStatus({ status: "DRAFT", startDate: d("2026-06-16"), endDate: null }, NOW),
    ).toBeNull();
    expect(
      automaticTargetStatus({ status: "DRAFT", startDate: null, endDate: null }, NOW),
    ).toBeNull();
  });

  it("ne touche pas une campagne déjà ouverte", () => {
    expect(
      automaticTargetStatus(
        { status: "COMMANDES_OUVERTES", startDate: d("2026-01-01"), endDate: d("2026-12-31") },
        NOW,
      ),
    ).toBeNull();
  });
});

describe("automaticTargetStatus — fermeture", () => {
  it("ferme après la date de fin, depuis brouillon, recensement ou commandes ouvertes", () => {
    for (const status of ["DRAFT", "RECENSEMENT", "COMMANDES_OUVERTES"] as const) {
      expect(
        automaticTargetStatus(
          { status, startDate: d("2026-01-01"), endDate: d("2026-06-14") },
          NOW,
        ),
      ).toBe("COMMANDES_FERMEES");
    }
  });

  it("la fermeture l'emporte quand début et fin sont dépassés", () => {
    expect(
      automaticTargetStatus(
        { status: "DRAFT", startDate: d("2026-01-01"), endDate: d("2026-03-01") },
        NOW,
      ),
    ).toBe("COMMANDES_FERMEES");
  });

  it("une date de fin sans heure est inclusive : fermeture à la fin de ce jour", () => {
    const campaign = {
      status: "COMMANDES_OUVERTES" as const,
      startDate: d("2026-01-01"),
      endDate: d("2026-06-15"),
    };
    expect(closingInstant(d("2026-06-15")).toISOString()).toBe("2026-06-16T00:00:00.000Z");
    expect(automaticTargetStatus(campaign, d("2026-06-15T23:59:59.000Z"))).toBeNull();
    expect(automaticTargetStatus(campaign, d("2026-06-16T00:00:01.000Z"))).toBe(
      "COMMANDES_FERMEES",
    );
  });

  it("une date de fin avec une heure précise est respectée telle quelle", () => {
    const end = d("2026-06-15T10:30:00.000Z");
    expect(closingInstant(end)).toEqual(end);
    expect(
      automaticTargetStatus({ status: "COMMANDES_OUVERTES", startDate: null, endDate: end }, NOW),
    ).toBe("COMMANDES_FERMEES");
  });

  it("ne ferme pas sans date de fin, ni avant celle-ci", () => {
    expect(
      automaticTargetStatus({ status: "COMMANDES_OUVERTES", startDate: null, endDate: null }, NOW),
    ).toBeNull();
    expect(
      automaticTargetStatus(
        { status: "COMMANDES_OUVERTES", startDate: null, endDate: d("2026-07-01") },
        NOW,
      ),
    ).toBeNull();
  });
});

describe("automaticTargetStatus — statuts jamais touchés", () => {
  it("laisse intactes les campagnes fermées, en production, en expédition et archivées", () => {
    for (const status of [
      "COMMANDES_FERMEES",
      "PRODUCTION",
      "EXPEDITION",
      "TERMINEE",
      "ANNULEE",
    ] as const) {
      expect(
        automaticTargetStatus(
          { status, startDate: d("2026-01-01"), endDate: d("2026-02-01") },
          NOW,
        ),
      ).toBeNull();
    }
  });
});

describe("cohérence avec la machine à états", () => {
  it("chaque cible est atteignable depuis chaque statut de départ, étape par étape", () => {
    const path = ["DRAFT", "RECENSEMENT", "COMMANDES_OUVERTES", "COMMANDES_FERMEES"] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(() => assertValidCampaignTransition(path[i]!, path[i + 1]!)).not.toThrow();
    }
  });
});
