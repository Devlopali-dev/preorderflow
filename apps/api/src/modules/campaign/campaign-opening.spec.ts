import { describe, expect, it } from "vitest";
import { campaignPublicUrl, groupInterestsByEmail } from "./campaign-opening";

const item = (quantity: number, color: string | null) => ({
  quantity,
  variant: { color: color ? { name: color } : null },
});

describe("groupInterestsByEmail", () => {
  it("un seul destinataire par adresse, quantités et couleurs additionnées", () => {
    const result = groupInterestsByEmail([
      { email: "a@example.com", firstName: "Alice", items: [item(2, "Rouge"), item(1, "Bleu")] },
      { email: "A@Example.com ", firstName: "Alice bis", items: [item(1, "Rouge")] },
      { email: "b@example.com", firstName: "Bob", items: [item(3, "Bleu")] },
    ]);
    expect(result).toEqual([
      {
        email: "a@example.com",
        firstName: "Alice",
        quantity: 4,
        details: " (3 × Rouge, 1 × Bleu)",
      },
      { email: "b@example.com", firstName: "Bob", quantity: 3, details: " (3 × Bleu)" },
    ]);
  });

  it("sans couleur (variante standard), pas de détail entre parenthèses", () => {
    expect(
      groupInterestsByEmail([
        { email: "c@example.com", firstName: "Claire", items: [item(5, null)] },
      ]),
    ).toEqual([{ email: "c@example.com", firstName: "Claire", quantity: 5, details: "" }]);
  });

  it("ignore une adresse vide", () => {
    expect(
      groupInterestsByEmail([{ email: "  ", firstName: "X", items: [item(1, null)] }]),
    ).toEqual([]);
  });
});

describe("campaignPublicUrl", () => {
  it("construit le lien de la page publique, sans double slash", () => {
    expect(campaignPublicUrl("stylo-1", "https://shop.example.com/")).toBe(
      "https://shop.example.com/campaigns/stylo-1",
    );
    expect(campaignPublicUrl("stylo-1", "http://localhost:3000")).toBe(
      "http://localhost:3000/campaigns/stylo-1",
    );
  });
});
