import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { NotificationTemplate } from "@preorderflow/database";
import { SettingsService } from "./settings.service";
import { TestEmailSettingsDto, UpdateSettingsDto } from "./dto/update-settings.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";
import { Roles } from "../auth/roles.decorator";

// Identifiants de messagerie = donnée sensible : lecture ouverte à tout
// admin authentifié (juste des booléens/valeurs non sensibles, jamais un
// secret), écriture restreinte à ADMIN (même logique que le RGPD §24).
@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async get() {
    const view = await this.settingsService.getPublicView();
    return { ...view, templates: Object.values(NotificationTemplate) };
  }

  @Roles("ADMIN")
  @Patch()
  async update(@Body() dto: UpdateSettingsDto, @CurrentAdminId() adminId: string) {
    const result = await this.settingsService.update(dto);
    // Jamais les valeurs elles-mêmes dans l'audit — juste quels champs ont
    // été touchés (un secret ne doit jamais atterrir dans un journal).
    // class-transformer instancie tous les champs déclarés du DTO (avec
    // `undefined` pour ceux non envoyés) — Object.keys() les listerait tous
    // sans ce filtre, faussant l'audit sur ce qui a réellement changé.
    const fieldsChanged = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "AppSettings", "singleton", {
      fieldsChanged,
    });
    return result;
  }

  // Throttle dédié — envoie un vrai email/push, pas question qu'un compte
  // ADMIN compromis serve de relai de spam même limité aux 100 req/min
  // globales du throttler par défaut.
  @Roles("ADMIN")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("test-email")
  testEmail(@Body() dto: TestEmailSettingsDto) {
    return this.settingsService.testEmail(dto);
  }

  @Roles("ADMIN")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("test-ntfy")
  testNtfy(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.testNtfy(dto);
  }
}
