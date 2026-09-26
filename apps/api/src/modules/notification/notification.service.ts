import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { createEmailProvider, EmailProvider } from "./email-provider";
import { renderTemplate, TemplatePayloads } from "./notification-templates";
import { sendNtfyNotification } from "./ntfy-provider";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly provider: EmailProvider;

  constructor() {
    this.provider = createEmailProvider();
  }

  async sendEmail<T extends keyof TemplatePayloads>(
    to: string,
    template: T,
    payload: TemplatePayloads[T],
  ) {
    const { subject, html } = renderTemplate(template, payload);

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
      const { providerReference } = await this.provider.send(to, subject, html);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date(), payload: { ...payload, providerReference } as object },
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
   * sans dépendance obligatoire : no-op si PREORDERFLOW_NTFY_TOPIC n'est pas configuré.
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
      await sendNtfyNotification({ title, message, tags });
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
