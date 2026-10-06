import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNtfyUrl,
  encodeNtfyHeader,
  isNtfyConfigured,
  ntfyAuthHeader,
  sendNtfyNotification,
} from "./ntfy-provider";

describe("ntfy-provider", () => {
  afterEach(() => {
    delete process.env.PREORDERFLOW_NTFY_TOPIC;
    delete process.env.PREORDERFLOW_NTFY_URL;
    delete process.env.PREORDERFLOW_NTFY_AUTH;
    vi.unstubAllGlobals();
  });

  it("n'est pas configuré sans PREORDERFLOW_NTFY_TOPIC", () => {
    expect(isNtfyConfigured()).toBe(false);
  });

  it("est configuré dès qu'un topic est présent", () => {
    process.env.PREORDERFLOW_NTFY_TOPIC = "preorderflow-admin";
    expect(isNtfyConfigured()).toBe(true);
  });

  it("construit l'URL avec le serveur public par défaut", () => {
    process.env.PREORDERFLOW_NTFY_TOPIC = "preorderflow-admin";
    expect(buildNtfyUrl()).toBe("https://ntfy.sh/preorderflow-admin");
  });

  it("respecte un serveur self-hosted et retire le slash final", () => {
    process.env.PREORDERFLOW_NTFY_TOPIC = "admin";
    process.env.PREORDERFLOW_NTFY_URL = "https://ntfy.mondomaine.fr/";
    expect(buildNtfyUrl()).toBe("https://ntfy.mondomaine.fr/admin");
  });

  it("ne fait aucun appel réseau si non configuré", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await sendNtfyNotification({ title: "Test", message: "Test" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envoie titre et message quand configuré", async () => {
    process.env.PREORDERFLOW_NTFY_TOPIC = "preorderflow-admin";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    await sendNtfyNotification({
      title: "Nouvelle commande",
      message: "2026-0001",
      tags: ["package"],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://ntfy.sh/preorderflow-admin",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Title: "Nouvelle commande", Tags: "package" }),
        body: "2026-0001",
      }),
    );
  });

  it("ajoute l'en-tête Authorization en Basic quand PREORDERFLOW_NTFY_AUTH est défini", async () => {
    process.env.PREORDERFLOW_NTFY_TOPIC = "admin";
    process.env.PREORDERFLOW_NTFY_AUTH = "jeff:secret";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    await sendNtfyNotification({ title: "T", message: "M" });

    const expectedAuth = `Basic ${Buffer.from("jeff:secret").toString("base64")}`;
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expectedAuth }),
      }),
    );
  });

  it("envoie un jeton d'accès (tk_…) en Bearer, pas en Basic", () => {
    expect(ntfyAuthHeader("tk_abc123")).toBe("Bearer tk_abc123");
    expect(ntfyAuthHeader("jeff:secret")).toMatch(/^Basic /);
  });

  it("encode un titre accentué en RFC 2047 et laisse l'ASCII intact", () => {
    expect(encodeNtfyHeader("Nouvelle commande")).toBe("Nouvelle commande");
    const encoded = encodeNtfyHeader("Paiement reçu");
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    const b64 = encoded.slice("=?UTF-8?B?".length, -2);
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe("Paiement reçu");
  });
});
