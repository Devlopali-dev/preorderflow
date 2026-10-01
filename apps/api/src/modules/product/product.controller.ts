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
import { diskStorage } from "multer";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { ProductService } from "./product.service";
import { deleteUploadedFiles } from "../../common/uploaded-files";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto, UpdateVariantDto } from "./dto/variant.dto";
import { Public } from "../auth/public.decorator";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

@ApiTags("products")
@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Lecture publique : prix produit affiché sur la page vitrine de campagne.
  @Public()
  @Get()
  list() {
    return this.productService.list();
  }

  @Public()
  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Post(":id/variants")
  addVariant(@Param("id") id: string, @Body() dto: CreateVariantDto) {
    return this.productService.addVariant(id, dto.colorId);
  }

  @Patch(":id/variants/:variantId")
  updateVariant(
    @Param("id") id: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productService.setVariantActive(id, variantId, dto.active);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string) {
    return this.productService.archive(id);
  }

  // Stockage disque local (apps/api/uploads/products, servi en statique par
  // main.ts) — pas d'infra propriétaire (S3...) requise pour le cœur de
  // l'app (§32). Nom de fichier généré : jamais le nom fourni par le client.
  @ApiConsumes("multipart/form-data")
  @Post(":id/photo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: join(__dirname, "..", "..", "..", "uploads", "products"),
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
    try {
      return await this.productService.addPhoto(id, `/uploads/products/${file.filename}`);
    } catch (error) {
      // Limite atteinte ou produit introuvable : pas d'image orpheline sur le disque.
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  @Delete(":id/photos/:photoId")
  async removePhoto(@Param("id") id: string, @Param("photoId") photoId: string) {
    const { product, removedUrl } = await this.productService.removePhoto(id, photoId);
    await deleteUploadedFiles([removedUrl]);
    return product;
  }
}
