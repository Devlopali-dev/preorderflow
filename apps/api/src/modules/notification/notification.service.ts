import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { createEmailProviderFromConfig } from "./email-provider";
import { renderPlainTextAsHtml, wrapEmail } from "./email-layout";
import { renderTemplate, TemplatePayloads } from "./notification-templates";
import { sendNtfyNotificationWithConfig } from "./ntfy-provider";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async sendEmail<T extends keyof TemplatePayloads>(
    to: string,
    template: T,
    payload: TemplatePayloads[T],
  ) {
    const { subject, html } = await renderTemplate(template, payload);

    const notification = await prisma.notification.create({
      data: {
        channel: "EMAIL",
        template,
        recipient: to,
        payload: payload as object,
        status: "PENDING",
      },
    });

    try {
      // Résolu à chaque envoi (pas mis en cache au démarrage) — un
      // changement de config depuis /settings prend effet immédiatement.
      const config = await this.settingsService.getEmailConfig();
      const provider = createEmailProviderFromConfig(config);
      const { providerReference } = await provider.send(to, subject, html);
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          payload: { ...payload, providerReference } as object,
        },
      });
    } catch (error) {
      // Une notification qui échoue ne doit jamais faire échouer l'action
      // métier qui l'a déclenchée (commande créée, paiement confirmé...).
      this.logger.warn(`Échec d'envoi email (${template}) à ${to}: ${(error as Error).message}`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED", error: (error as Error).message },
      });
    }
  }

  /**
   * Message libre (objet + texte saisis par l'admin) habillé du même layout
   * que les emails automatiques. `cc` : copie carbone (adresse admin).
   * Retourne false en cas d'échec — ne throw jamais, pour que l'envoi
   * groupé continue sur les destinataires suivants.
   */
  async sendBulkMessage(to: string, subject: string, message: string, cc?: string) {
    const notification = await prisma.notification.create({
      data: {
        channel: "EMAIL",
        template: "BULK_MESSAGE",
        recipient: to,
        payload: { subject, ...(cc ? { cc } : {}) } as object,
        status: "PENDING",
      },
    });

    try {
      const [config, profile] = await Promise.all([
        this.settingsService.getEmailConfig(),
        this.settingsService.getBusinessProfile(),
      ]);
      const html = wrapEmail(renderPlainTextAsHtml(message), profile.businessName);
      const provider = createEmailProviderFromConfig(config);
      const { providerReference } = await provider.send(to, subject, html, { cc });
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          payload: { subject, ...(cc ? { cc } : {}), providerReference } as object,
        },
      });
      return true;
    } catch (error) {
      this.logger.warn(`Échec d'envoi message groupé à ${to}: ${(error as Error).message}`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED", error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Alerte push admin (ntfy) — canal WEBHOOK distinct de l'email client,
   * pour être notifié en temps réel (nouvelle commande, paiement reçu...)
   * sans dépendance obligatoire : no-op si aucun topic n'est configuré.
   */
  async notifyAdmin(title: string, message: string, tags?: string[]) {
    const notification = await prisma.notification.create({
      data: {
        channel: "WEBHOOK",
        template: "ADMIN_ALERT",
        recipient: "ntfy",
        payload: { title, message } as object,
        status: "PENDING",
      },
    });

    try {
      const config = await this.settingsService.getNtfyConfig();
      await sendNtfyNotificationWithConfig({ title, message, tags }, config);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Échec d'envoi ntfy "${title}": ${(error as Error).message}`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED", error: (error as Error).message },
      });
    }
  }
}
