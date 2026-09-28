import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { createEmailProviderFromConfig } from "./email-provider";
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
