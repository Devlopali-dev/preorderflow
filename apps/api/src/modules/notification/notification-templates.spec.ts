import { describe, expect, it } from "vitest";
import { renderTemplate } from "./notification-templates";

describe("renderTemplate", () => {
  it("INTEREST_REGISTERED précise que ce n'est pas une commande", () => {
    const email = renderTemplate("INTEREST_REGISTERED", {
      firstName: "Alice",
      campaignName: "Sifflet anti-agression #1",
      quantity: 3,
    });
    expect(email.subject).toContain("Sifflet anti-agression #1");
    expect(email.html).toContain("Alice");
    expect(email.html).toContain("3");
    expect(email.html).toMatch(/ne constitue pas une commande/);
  });

  it("ORDER_CREATED inclut le numéro et le total", () => {
    const email = renderTemplate("ORDER_CREATED", {
      firstName: "Bob",
      orderNumber: "2026-0042",
      total: "15.00",
    });
    expect(email.subject).toContain("2026-0042");
    expect(email.html).toContain("15.00");
  });

  it("ORDER_SHIPPED inclut le lien de suivi quand fourni", () => {
    const withTracking = renderTemplate("ORDER_SHIPPED", {
      firstName: "Bob",
      orderNumber: "2026-0042",
      trackingUrl: "https://track.example.com/abc",
    });
    expect(withTracking.html).toContain("https://track.example.com/abc");

    const withoutTracking = renderTemplate("ORDER_SHIPPED", {
      firstName: "Bob",
      orderNumber: "2026-0042",
    });
    expect(withoutTracking.html).not.toContain("undefined");
  });

  it("chaque template produit un sujet et un corps non vides", () => {
    const samples = [
      renderTemplate("ORDERS_OPENED", { campaignName: "X", campaignUrl: "https://x" }),
      renderTemplate("PAYMENT_RECEIVED", { firstName: "A", orderNumber: "1", amount: "10" }),
      renderTemplate("ORDER_READY", { firstName: "A", orderNumber: "1" }),
      renderTemplate("ORDER_DELIVERED", { firstName: "A", orderNumber: "1" }),
    ];
    for (const email of samples) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html.length).toBeGreaterThan(0);
    }
  });
});
