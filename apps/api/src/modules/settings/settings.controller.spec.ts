import { afterEach, describe, expect, it } from "vitest";
import { SettingsController } from "./settings.controller";

const ENV_KEYS = [
  "NOTIFICATION_EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "EMAIL_FROM",
  "PREORDERFLOW_NTFY_TOPIC",
] as const;

describe("SettingsController", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("indique le canal email actif quand resend est configuré", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    const result = new SettingsController().get();
    expect(result.email.provider).toBe("resend");
    expect(result.email.active).toBe(true);
  });

  it("indique le canal email inactif sans configuration", () => {
    const result = new SettingsController().get();
    expect(result.email.active).toBe(false);
    expect(result.email.resendConfigured).toBe(false);
    expect(result.email.smtpConfigured).toBe(false);
  });

  it("ne remonte jamais la clé API en clair", () => {
    process.env.RESEND_API_KEY = "re_secret";
    const result = new SettingsController().get();
    expect(JSON.stringify(result)).not.toContain("re_secret");
  });

  it("liste les templates de notification disponibles", () => {
    const result = new SettingsController().get();
    expect(result.templates).toContain("ORDER_CREATED");
    expect(result.templates).toContain("CUSTOMER_MAGIC_LINK");
  });
});
