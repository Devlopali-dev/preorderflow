import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleEmailProvider,
  ResendEmailProvider,
  SmtpEmailProvider,
  createEmailProvider,
} from "./email-provider";

const ENV_KEYS = [
  "NOTIFICATION_EMAIL_PROVIDER",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
] as const;

describe("createEmailProvider", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("retombe sur la console sans provider configuré", () => {
    expect(createEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("retombe sur la console si resend est choisi sans clé API", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    expect(createEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("utilise Resend quand configuré", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    expect(createEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("retombe sur la console si smtp est choisi sans host", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "smtp";
    expect(createEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("utilise SMTP quand configuré", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.example.com";
    expect(createEmailProvider()).toBeInstanceOf(SmtpEmailProvider);
  });
});

describe("SmtpEmailProvider", () => {
  it("délègue l'envoi au transport nodemailer sous-jacent et remonte le messageId", async () => {
    const provider = new SmtpEmailProvider(
      "smtp.example.com",
      587,
      false,
      "user",
      "pass",
      "PreOrderFlow <no-reply@example.com>",
    );
    const sendMail = vi.fn().mockResolvedValue({ messageId: "<abc@smtp>" });
    // @ts-expect-error accès au transport privé pour éviter un vrai appel réseau SMTP
    provider.transport = { sendMail };

    const result = await provider.send("client@example.com", "Sujet", "<p>Corps</p>");

    expect(sendMail).toHaveBeenCalledWith({
      from: "PreOrderFlow <no-reply@example.com>",
      to: "client@example.com",
      subject: "Sujet",
      html: "<p>Corps</p>",
    });
    expect(result).toEqual({ providerReference: "<abc@smtp>" });
  });
});
