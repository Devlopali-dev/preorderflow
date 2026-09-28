import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { diskStorage } from "multer";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { CampaignService } from "./campaign.service";
import {
  CreateCampaignDto,
  CreateInterestDto,
  UpdateCampaignDto,
  UpdateCampaignStatusDto,
} from "./dto/create-campaign.dto";
import { Public } from "../auth/public.decorator";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];

@ApiTags("campaigns")
@Controller("campaigns")
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  // Lecture publique : page vitrine de campagne (§19) + dashboard admin.
  @Public()
  @Get()
  list() {
    return this.campaignService.list();
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignService.create(dto);
  }

  @Public()
  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.campaignService.getBySlugOrId(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.campaignService.remove(id);
  }

  // Même pattern que ProductController (stockage disque local, nom de
  // fichier jamais fourni par le client — cf. docs/architecture.md §8).
  @ApiConsumes("multipart/form-data")
  @Post(":id/photo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: join(__dirname, "..", "..", "..", "uploads", "campaigns"),
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException("Seules les images JPEG, PNG ou WebP sont acceptées"),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadPhoto(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu");
    }
    return this.campaignService.update(id, { imageUrl: `/uploads/campaigns/${file.filename}` });
  }

  // PDF de présentation : contrairement au produit, la campagne l'accepte
  // en upload réel (demande utilisateur) et pas seulement en URL texte.
  @ApiConsumes("multipart/form-data")
  @Post(":id/document")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: join(__dirname, "..", "..", "..", "uploads", "campaigns"),
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("Seuls les fichiers PDF sont acceptés"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadDocument(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu");
    }
    return this.campaignService.update(id, {
      documentUrl: `/uploads/campaigns/${file.filename}`,
    });
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.campaignService.updateStatus(id, dto.status as never);
  }

  @Public()
  @Get(":id/statistics")
  getStatistics(@Param("id") id: string) {
    return this.campaignService.getStatistics(id);
  }

  // Formulaire public de recensement — rate-limité en plus du throttler
  // global (cf. docs/security.md), au-delà de l'anti-spam honeypot.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/interests")
  registerInterest(@Param("id") id: string, @Body() dto: CreateInterestDto) {
    return this.campaignService.registerInterest(id, dto);
  }
}
