import { beforeEach, describe, expect, it, vi } from "vitest";

const { orderFindMany } = vi.hoisted(() => ({ orderFindMany: vi.fn() }));
vi.mock("@preorderflow/database", () => ({
  prisma: { order: { findMany: orderFindMany } },
}));

import { OrderService } from "./order.service";
import { renderPlainTextAsHtml } from "../notification/email-layout";

const orderOf = (email: string) => ({ customer: { email } });

describe("OrderService — message groupé", () => {
  const sendBulkMessage = vi.fn();
  const getBusinessProfile = vi.fn();
  const service = new OrderService({ sendBulkMessage } as never, { getBusinessProfile } as never);

  beforeEach(() => {
    for (const mock of [orderFindMany, sendBulkMessage, getBusinessProfile]) mock.mockReset();
    sendBulkMessage.mockResolvedValue(true);
    getBusinessProfile.mockResolvedValue({ businessName: "Boutique", contactEmail: "admin@x.fr" });
  });

  it("dédoublonne les clients par email et met l'admin en copie", async () => {
    orderFindMany.mockResolvedValue([orderOf("a@x.fr"), orderOf("A@x.fr "), orderOf("b@x.fr")]);

    const result = await service.sendBulkMessage(["o1", "o2", "o3"], "Objet", "Texte");

    expect(sendBulkMessage).toHaveBeenCalledTimes(2);
    expect(sendBulkMessage).toHaveBeenCalledWith("a@x.fr", "Objet", "Texte", "admin@x.fr");
    expect(result).toEqual({ recipients: 2, sent: 2, failed: 0, ccApplied: true });
  });

  it("continue après un échec et le compte", async () => {
    orderFindMany.mockResolvedValue([orderOf("a@x.fr"), orderOf("b@x.fr")]);
    sendBulkMessage.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await service.sendBulkMessage(["o1", "o2"], "Objet", "Texte");

    expect(result).toMatchObject({ sent: 1, failed: 1 });
  });

  it("n'applique pas de copie sans adresse de contact", async () => {
    orderFindMany.mockResolvedValue([orderOf("a@x.fr")]);
    getBusinessProfile.mockResolvedValue({ businessName: null, contactEmail: null });

    const result = await service.sendBulkMessage(["o1"], "Objet", "Texte");

    expect(sendBulkMessage).toHaveBeenCalledWith("a@x.fr", "Objet", "Texte", undefined);
    expect(result.ccApplied).toBe(false);
  });

  it("refuse si aucune commande n'existe", async () => {
    orderFindMany.mockResolvedValue([]);
    await expect(service.sendBulkMessage(["o1"], "Objet", "Texte")).rejects.toThrow();
  });
});

describe("renderPlainTextAsHtml", () => {
  it("échappe le HTML et crée des paragraphes", () => {
    const html = renderPlainTextAsHtml("Bonjour <b>\nligne 2\n\nSecond");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).toContain("<br>");
    expect(html.match(/<p /g)).toHaveLength(2);
  });
});
