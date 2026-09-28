import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { TestEmailSettingsDto, UpdateSettingsDto } from "./dto/update-settings.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { createEmailProviderFromConfig } from "../notification/email-provider";
import { sendNtfyNotificationWithConfig } from "../notification/ntfy-provider";
import { DEFAULT_TEMPLATES, TemplatePayloads } from "../notification/notification-templates";

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
      businessName: row?.businessName ?? null,
      contactEmail: row?.contactEmail ?? null,
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
          emailProvider === "resend"
            ? resendConfigured
            : emailProvider === "smtp"
              ? smtpConfigured
              : false,
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

  // Teste avec les valeurs du formulaire (pas forcément encore enregistrées)
  // — un admin doit pouvoir valider avant de sauvegarder. Un champ omis
  // retombe sur la config déjà enregistrée (DB puis .env). Renvoie un
  // succès/échec plutôt que de laisser remonter une exception : un test qui
  // échoue est un résultat attendu ("mauvais mot de passe"), pas une panne.
  async testEmail(dto: TestEmailSettingsDto): Promise<{ success: boolean; message: string }> {
    const saved = await this.getEmailConfig();
    const provider = createEmailProviderFromConfig({
      provider: dto.emailProvider ?? saved.provider,
      resendApiKey: dto.resendApiKey || saved.resendApiKey,
      smtpHost: dto.smtpHost || saved.smtpHost,
      smtpPort: dto.smtpPort ?? saved.smtpPort,
      smtpSecure: dto.smtpSecure ?? saved.smtpSecure,
      smtpUser: dto.smtpUser || saved.smtpUser,
      smtpPassword: dto.smtpPassword || saved.smtpPassword,
      from: dto.emailFrom || saved.from,
    });

    try {
      await provider.send(
        dto.to,
        "Email de test PreOrderFlow",
        "<p>Cet email confirme que la configuration email de PreOrderFlow fonctionne.</p>",
      );
      return { success: true, message: `Email de test envoyé à ${dto.to}` };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  async testNtfy(dto: UpdateSettingsDto): Promise<{ success: boolean; message: string }> {
    const saved = await this.getNtfyConfig();
    const config = {
      url: dto.ntfyUrl || saved.url,
      topic: dto.ntfyTopic || saved.topic,
      auth: dto.ntfyAuth || saved.auth,
    };

    if (!config.topic) {
      return { success: false, message: "Aucun sujet (topic) ntfy renseigné" };
    }

    try {
      await sendNtfyNotificationWithConfig(
        {
          title: "Test PreOrderFlow",
          message: "Cette alerte confirme que ntfy est bien configuré.",
        },
        config,
      );
      return { success: true, message: `Notification envoyée sur le sujet "${config.topic}"` };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // Liste éditable = uniquement les templates email (TemplatePayloads) —
  // ADMIN_ALERT (push ntfy) n'a pas de rendu email et ne passe jamais par
  // renderTemplate(), donc pas de sens à l'éditer ici.
  async getTemplates() {
    const overrides = await prisma.notificationTemplateOverride.findMany();
    const overrideByTemplate = new Map(overrides.map((o) => [o.template, o]));

    return (Object.keys(DEFAULT_TEMPLATES) as Array<keyof TemplatePayloads>).map((template) => {
      const override = overrideByTemplate.get(template);
      const effective = override ?? DEFAULT_TEMPLATES[template];
      const placeholders = [
        ...effective.html.matchAll(/\{\{(\w+)\}\}/g),
        ...effective.subject.matchAll(/\{\{(\w+)\}\}/g),
      ].map((m) => m[1]);
      return {
        template,
        subject: effective.subject,
        html: effective.html,
        customized: Boolean(override),
        placeholders: [...new Set(placeholders)],
      };
    });
  }

  async updateTemplate(template: keyof TemplatePayloads, dto: UpdateTemplateDto) {
    if (!(template in DEFAULT_TEMPLATES)) {
      throw new NotFoundException(`Template "${template}" introuvable`);
    }
    await prisma.notificationTemplateOverride.upsert({
      where: { template },
      create: { template, subject: dto.subject, html: dto.html },
      update: { subject: dto.subject, html: dto.html },
    });
    return { template, subject: dto.subject, html: dto.html, customized: true };
  }

  async resetTemplate(template: keyof TemplatePayloads) {
    if (!(template in DEFAULT_TEMPLATES)) {
      throw new NotFoundException(`Template "${template}" introuvable`);
    }
    await prisma.notificationTemplateOverride.deleteMany({ where: { template } });
    return { template, ...DEFAULT_TEMPLATES[template], customized: false };
  }
}
