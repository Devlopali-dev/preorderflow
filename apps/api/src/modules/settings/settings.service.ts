import { Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

const SINGLETON_ID = "singleton";

export interface EffectiveEmailConfig {
  provider: string | null;
  resendApiKey: string | undefined;
  smtpHost: string | undefined;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPassword: string | undefined;
  from: string;
}

export interface EffectiveNtfyConfig {
  url: string;
  topic: string | undefined;
  auth: string | undefined;
}

@Injectable()
export class SettingsService {
  private async getRow() {
    return prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
  }

  // Aucune donnée sensible : juste de quoi savoir quel canal est actif et
  // préremplir le formulaire d'édition sans jamais republier un secret.
  async getPublicView() {
    const row = await this.getRow();
    const emailProvider = row?.emailProvider ?? process.env.NOTIFICATION_EMAIL_PROVIDER ?? null;
    const resendConfigured = Boolean(row?.resendApiKey || process.env.RESEND_API_KEY);
    const smtpHost = row?.smtpHost ?? process.env.SMTP_HOST ?? null;
    const smtpConfigured = Boolean(smtpHost);

    return {
      email: {
        provider: emailProvider,
        resendConfigured,
        smtpConfigured,
        from: row?.emailFrom ?? process.env.EMAIL_FROM ?? null,
        smtpHost,
        smtpPort: row?.smtpPort ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null),
        smtpSecure: row?.smtpSecure ?? process.env.SMTP_SECURE === "true",
        smtpUser: row?.smtpUser ?? process.env.SMTP_USER ?? null,
        active:
          emailProvider === "resend" ? resendConfigured : emailProvider === "smtp" ? smtpConfigured : false,
      },
      ntfy: {
        configured: Boolean(row?.ntfyTopic || process.env.PREORDERFLOW_NTFY_TOPIC),
        url: row?.ntfyUrl ?? process.env.PREORDERFLOW_NTFY_URL ?? "https://ntfy.sh",
        topic: row?.ntfyTopic ?? process.env.PREORDERFLOW_NTFY_TOPIC ?? null,
      },
    };
  }

  async update(dto: UpdateSettingsDto) {
    // undefined => ne touche pas la colonne (Prisma) ; c'est déjà le
    // comportement de tous les champs optionnels du DTO.
    await prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto },
      update: { ...dto },
    });
    return this.getPublicView();
  }

  async getEmailConfig(): Promise<EffectiveEmailConfig> {
    const row = await this.getRow();
    return {
      provider: row?.emailProvider ?? process.env.NOTIFICATION_EMAIL_PROVIDER ?? null,
      resendApiKey: row?.resendApiKey ?? process.env.RESEND_API_KEY,
      smtpHost: row?.smtpHost ?? process.env.SMTP_HOST,
      smtpPort: row?.smtpPort ?? Number(process.env.SMTP_PORT ?? "587"),
      smtpSecure: row?.smtpSecure ?? process.env.SMTP_SECURE === "true",
      smtpUser: row?.smtpUser ?? process.env.SMTP_USER,
      smtpPassword: row?.smtpPassword ?? process.env.SMTP_PASSWORD,
      from: row?.emailFrom ?? process.env.EMAIL_FROM ?? "PreOrderFlow <no-reply@example.com>",
    };
  }

  async getNtfyConfig(): Promise<EffectiveNtfyConfig> {
    const row = await this.getRow();
    return {
      url: row?.ntfyUrl ?? process.env.PREORDERFLOW_NTFY_URL ?? "https://ntfy.sh",
      topic: row?.ntfyTopic ?? process.env.PREORDERFLOW_NTFY_TOPIC,
      auth: row?.ntfyAuth ?? process.env.PREORDERFLOW_NTFY_AUTH,
    };
  }
}
