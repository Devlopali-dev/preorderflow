import { createTransport } from "nodemailer";

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ providerReference?: string }>;
}

// Fallback sans dépendance obligatoire (§32) : si aucune clé API n'est
// configurée, on journalise au lieu d'échouer — utile en dev/démo et pour
// tourner le cœur de l'application sans compte Resend.
export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string) {
    console.log(`[email:console] to=${to} subject="${subject}"\n${html}`);
    return {};
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, html: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend a répondu ${res.status}: ${body}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerReference: data.id };
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: ReturnType<typeof createTransport>;

  constructor(
    host: string,
    port: number,
    secure: boolean,
    user: string | undefined,
    password: string | undefined,
    private readonly from: string,
  ) {
    this.transport = createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async send(to: string, subject: string, html: string) {
    const info = await this.transport.sendMail({ from: this.from, to, subject, html });
    return { providerReference: info.messageId };
  }
}

// Sélection explicite via NOTIFICATION_EMAIL_PROVIDER (resend|smtp) plutôt
// qu'une détection implicite : évite qu'une clé Resend oubliée en config
// bascule silencieusement le provider (§32, aucune dépendance obligatoire).
export function createEmailProvider(): EmailProvider {
  const from = process.env.EMAIL_FROM ?? "PreOrderFlow <no-reply@example.com>";
  const provider = process.env.NOTIFICATION_EMAIL_PROVIDER;

  if (provider === "smtp") {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? "587");
    if (!host) {
      return new ConsoleEmailProvider();
    }
    return new SmtpEmailProvider(
      host,
      port,
      process.env.SMTP_SECURE === "true",
      process.env.SMTP_USER,
      process.env.SMTP_PASSWORD,
      from,
    );
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return new ConsoleEmailProvider();
    }
    return new ResendEmailProvider(apiKey, from);
  }

  return new ConsoleEmailProvider();
}

// Même sélection que createEmailProvider(), mais à partir d'une config déjà
// résolue (base de données + fallback .env, cf. SettingsService) plutôt que
// de relire process.env directement — utilisée par NotificationService pour
// qu'un changement depuis /settings prenne effet sans redémarrer l'API.
export function createEmailProviderFromConfig(config: {
  provider: string | null;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  from: string;
}): EmailProvider {
  if (config.provider === "smtp") {
    if (!config.smtpHost) {
      return new ConsoleEmailProvider();
    }
    return new SmtpEmailProvider(
      config.smtpHost,
      config.smtpPort,
      config.smtpSecure,
      config.smtpUser,
      config.smtpPassword,
      config.from,
    );
  }

  if (config.provider === "resend") {
    if (!config.resendApiKey) {
      return new ConsoleEmailProvider();
    }
    return new ResendEmailProvider(config.resendApiKey, config.from);
  }

  return new ConsoleEmailProvider();
}
