import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, substitute } from "./notification-templates";

// renderTemplate() lit désormais une éventuelle surcharge en base (DB) —
// pas de test unitaire dessus (comme les autres services DB de ce repo,
// validé en réel). On couvre ici la logique pure : substitution
// {{placeholder}} et le contenu des templates par défaut.
describe("substitute", () => {
  it("remplace les placeholders présents dans le payload", () => {
    expect(substitute("Bonjour {{firstName}}", { firstName: "Alice" })).toBe("Bonjour Alice");
  });

  it("remplace un placeholder absent par une chaîne vide, jamais 'undefined'", () => {
    expect(substitute("Suivi : {{trackingUrl}}", {})).toBe("Suivi : ");
  });

  it("remplace plusieurs occurrences du même placeholder", () => {
    expect(substitute("{{x}} et {{x}}", { x: "A" })).toBe("A et A");
  });
});

describe("DEFAULT_TEMPLATES", () => {
  it("INTEREST_REGISTERED précise que ce n'est pas une commande", () => {
    const email = DEFAULT_TEMPLATES.INTEREST_REGISTERED;
    const rendered = substitute(email.html, {
      firstName: "Alice",
      campaignName: "Stylo #1",
      quantity: 3,
    });
    expect(substitute(email.subject, { campaignName: "Stylo #1" })).toContain("Stylo #1");
    expect(rendered).toContain("Alice");
    expect(rendered).toContain("3");
    expect(rendered).toMatch(/ne constitue pas une commande/);
  });

  it("ORDER_CREATED inclut le numéro et le total", () => {
    const email = DEFAULT_TEMPLATES.ORDER_CREATED;
    const payload = { firstName: "Bob", orderNumber: "2026-0042", total: "15.00" };
    expect(substitute(email.subject, payload)).toContain("2026-0042");
    expect(substitute(email.html, payload)).toContain("15.00");
  });

  it("CUSTOMER_MAGIC_LINK inclut le lien et la durée de validité", () => {
    const email = DEFAULT_TEMPLATES.CUSTOMER_MAGIC_LINK;
    const rendered = substitute(email.html, {
      firstName: "Alice",
      magicLinkUrl: "https://app.example.com/mon-compte/verifier?token=abc",
      expiresInMinutes: 15,
    });
    expect(rendered).toContain("https://app.example.com/mon-compte/verifier?token=abc");
    expect(rendered).toContain("15 minutes");
  });

  it("chaque template a un sujet et un corps non vides", () => {
    for (const email of Object.values(DEFAULT_TEMPLATES)) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html.length).toBeGreaterThan(0);
    }
  });
});
