import {
  BadGatewayException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { NotificationTemplate } from "@preorderflow/database";
import { SettingsService } from "./settings.service";
import { TestEmailSettingsDto, UpdateSettingsDto } from "./dto/update-settings.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { AuditService } from "../audit/audit.service";
import { Public } from "../auth/public.decorator";
import { CurrentAdminId } from "../auth/current-admin.decorator";
import { Roles } from "../auth/roles.decorator";
import type { TemplatePayloads } from "../notification/notification-templates";

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

  // Barème de livraison : non sensible, affiché aux visiteurs sur le formulaire de commande.
  @Public()
  @Get("shipping")
  getShipping() {
    return this.settingsService.getShippingConfig();
  }

  // Appelle un service externe : throttle dédié, comme les autres actions qui sortent de l'API.
  @Roles("ADMIN")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("shipping/sync-tariffs")
  async syncTariffs(@CurrentAdminId() adminId: string) {
    let result;
    try {
      result = await this.settingsService.syncLaPosteTariffs();
    } catch (error) {
      throw new BadGatewayException(
        `Synchronisation des tarifs La Poste impossible : ${(error as Error).message}`,
      );
    }
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "AppSettings", "singleton", {
      fieldsChanged: ["carrierTariffs"],
    });
    return result;
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

  @Get("templates")
  getTemplates() {
    return this.settingsService.getTemplates();
  }

  @Roles("ADMIN")
  @Patch("templates/:template")
  async updateTemplate(
    @Param("template") template: keyof TemplatePayloads,
    @Body() dto: UpdateTemplateDto,
    @CurrentAdminId() adminId: string,
  ) {
    const result = await this.settingsService.updateTemplate(template, dto);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "NotificationTemplate", template, {
      fieldsChanged: ["subject", "html"],
    });
    return result;
  }

  @Roles("ADMIN")
  @Delete("templates/:template")
  async resetTemplate(
    @Param("template") template: keyof TemplatePayloads,
    @CurrentAdminId() adminId: string,
  ) {
    const result = await this.settingsService.resetTemplate(template);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "NotificationTemplate", template, {
      reset: true,
    });
    return result;
  }
}
