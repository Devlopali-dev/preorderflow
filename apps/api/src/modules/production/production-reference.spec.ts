import { describe, expect, it } from "vitest";
import {
  formatDateStamp,
  nextAvailableReference,
  productionReferenceBase,
  slugifyName,
} from "./production-reference";

describe("slugifyName", () => {
  it("met en minuscules, retire les accents et remplace les séparateurs par des tirets", () => {
    expect(slugifyName("Stylo à bille")).toBe("stylo-a-bille");
    expect(slugifyName("  Gourde inox 500ml !  ")).toBe("gourde-inox-500ml");
  });

  it("renvoie une chaîne vide quand il ne reste rien", () => {
    expect(slugifyName("—")).toBe("");
  });
});

describe("formatDateStamp", () => {
  it("formate en AAAAMMJJ sur la date UTC", () => {
    expect(formatDateStamp(new Date("2026-09-30T10:00:00.000Z"))).toBe("20260930");
    expect(formatDateStamp(new Date("2026-01-05T23:59:59.000Z"))).toBe("20260105");
  });
});

describe("productionReferenceBase", () => {
  it("compose nom-AAAAMMJJ", () => {
    expect(productionReferenceBase("Stylo", new Date("2026-09-30T08:00:00.000Z"))).toBe(
      "stylo-20260930",
    );
  });

  it("retombe sur « lot » si le nom ne donne aucun caractère utilisable", () => {
    expect(productionReferenceBase("???", new Date("2026-09-30T08:00:00.000Z"))).toBe(
      "lot-20260930",
    );
  });
});

describe("nextAvailableReference", () => {
  const base = "stylo-20260930";

  it("garde la base quand elle est libre", () => {
    expect(nextAvailableReference(base, [])).toBe(base);
    expect(nextAvailableReference(base, ["gourde-20260930"])).toBe(base);
  });

  it("ajoute #1 en cas de doublon", () => {
    expect(nextAvailableReference(base, [base])).toBe("stylo-20260930#1");
  });

  it("continue la numérotation : #2, #3…", () => {
    expect(nextAvailableReference(base, [base, "stylo-20260930#1"])).toBe("stylo-20260930#2");
    expect(nextAvailableReference(base, [base, "stylo-20260930#1", "stylo-20260930#2"])).toBe(
      "stylo-20260930#3",
    );
  });

  it("comble un trou plutôt que de sauter un numéro", () => {
    expect(nextAvailableReference(base, [base, "stylo-20260930#2"])).toBe("stylo-20260930#1");
  });
});
