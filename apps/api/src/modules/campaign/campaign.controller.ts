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
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { CampaignService } from "./campaign.service";
import { PdfThumbnailService } from "./pdf-thumbnail.service";
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
  constructor(
    private readonly campaignService: CampaignService,
    private readonly pdfThumbnailService: PdfThumbnailService,
  ) {}

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
    const url = `/uploads/campaigns/${file.filename}`;
    try {
      return await this.campaignService.addMedia(id, url, "IMAGE");
    } catch (error) {
      // Limite atteinte ou autre : pas d'image orpheline sur le disque.
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
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

    // Génère un vrai aperçu (image de la 1ère page) à côté du PDF, pour la
    // galerie publique. En cas d'échec (conversion ou limite atteinte), on
    // supprime les fichiers écrits sur disque : ne jamais laisser d'orphelins.
    const pdfUrl = `/uploads/campaigns/${file.filename}`;
    const thumbnailFilename = `${file.filename.slice(0, -extname(file.filename).length)}.jpg`;
    const thumbnailPath = join(file.destination, thumbnailFilename);

    let thumbnailUrl: string | null = null;
    try {
      await this.pdfThumbnailService.generateThumbnail(file.path, thumbnailPath);
      thumbnailUrl = `/uploads/campaigns/${thumbnailFilename}`;
      return await this.campaignService.addMedia(id, pdfUrl, "DOCUMENT", thumbnailUrl);
    } catch (error) {
      await Promise.all([
        unlink(file.path).catch(() => undefined),
        thumbnailUrl ? unlink(thumbnailPath).catch(() => undefined) : Promise.resolve(),
      ]);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Impossible de générer l'aperçu de ce PDF");
    }
  }

  @Delete(":id/media/:mediaId")
  async removeMedia(@Param("id") id: string, @Param("mediaId") mediaId: string) {
    const { campaign, removed } = await this.campaignService.removeMedia(id, mediaId);

    // Nettoie les fichiers associés (PDF + vignette) du disque local.
    const files = [removed.url, removed.thumbnailUrl]
      .filter((url): url is string => Boolean(url))
      .map((url) => join(process.cwd(), "uploads", url.replace(/^\/uploads\//, "")));
    await Promise.all(files.map((file) => unlink(file).catch(() => undefined)));

    return campaign;
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
