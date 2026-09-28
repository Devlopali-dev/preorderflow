import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationTemplate } from "@preorderflow/database";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
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
}
