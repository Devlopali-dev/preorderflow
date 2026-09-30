import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ColorService } from "./color.service";
import { CreateColorDto, UpdateColorDto } from "./dto/color.dto";
import { AuditService } from "../audit/audit.service";
import { CurrentAdminId } from "../auth/current-admin.decorator";
import { Roles } from "../auth/roles.decorator";

// Lecture ouverte à tout admin authentifié (choix des couleurs d'un produit),
// écriture réservée à ADMIN comme le reste des paramètres. La page publique
// d'une campagne reçoit ses couleurs via /campaigns, jamais via cette route.
@ApiTags("colors")
@Controller("colors")
export class ColorController {
  constructor(
    private readonly colorService: ColorService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.colorService.list();
  }

  @Roles("ADMIN")
  @Post()
  async create(@Body() dto: CreateColorDto, @CurrentAdminId() adminId: string) {
    const color = await this.colorService.create(dto);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "Color", color.id, {
      action: "created",
      name: color.name,
    });
    return color;
  }

  @Roles("ADMIN")
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateColorDto,
    @CurrentAdminId() adminId: string,
  ) {
    const color = await this.colorService.update(id, dto);
    const fieldsChanged = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "Color", color.id, {
      action: "updated",
      fieldsChanged,
    });
    return color;
  }

  @Roles("ADMIN")
  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentAdminId() adminId: string) {
    const removed = await this.colorService.remove(id);
    await this.auditService.log(adminId, "SETTINGS_UPDATED", "Color", removed.id, {
      action: "deleted",
      name: removed.name,
    });
    return removed;
  }
}
