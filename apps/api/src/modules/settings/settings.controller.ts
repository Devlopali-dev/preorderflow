import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationTemplate } from "@preorderflow/database";
import { isNtfyConfigured } from "../notification/ntfy-provider";

// Aucune donnée sensible exposée ici (jamais de clé API) — juste de quoi
// afficher dans /settings quel canal est actif et lequel ne l'est pas.
@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  @Get()
  get() {
    const emailProvider = process.env.NOTIFICATION_EMAIL_PROVIDER ?? null;
    return {
      email: {
        provider: emailProvider,
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        from: process.env.EMAIL_FROM ?? null,
        active:
          emailProvider === "resend"
            ? Boolean(process.env.RESEND_API_KEY)
            : emailProvider === "smtp"
              ? Boolean(process.env.SMTP_HOST)
              : false,
      },
      ntfy: {
        configured: isNtfyConfigured(),
      },
      templates: Object.values(NotificationTemplate),
    };
  }
}
