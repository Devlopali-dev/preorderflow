import { describe, expect, it } from "vitest";
import { nextAvailableSlug, slugifyName } from "./slug";

describe("slugifyName", () => {
  it("met en minuscules, retire les accents et remplace les séparateurs par des tirets", () => {
    expect(slugifyName("Stylo à bille")).toBe("stylo-a-bille");
    expect(slugifyName("  Gourde inox 500ml !  ")).toBe("gourde-inox-500ml");
  });

  it("renvoie une chaîne vide quand il ne reste rien", () => {
    expect(slugifyName("—")).toBe("");
  });
});

describe("nextAvailableSlug", () => {
  it("garde la base quand elle est libre", () => {
    expect(nextAvailableSlug("stylo", [])).toBe("stylo");
    expect(nextAvailableSlug("stylo", ["gourde"])).toBe("stylo");
  });

  it("ajoute -2, -3… en cas de doublon", () => {
    expect(nextAvailableSlug("stylo", ["stylo"])).toBe("stylo-2");
    expect(nextAvailableSlug("stylo", ["stylo", "stylo-2"])).toBe("stylo-3");
  });

  it("ne confond pas un slug qui commence pareil avec un doublon", () => {
    expect(nextAvailableSlug("stylo", ["stylo-bille"])).toBe("stylo");
  });
});
