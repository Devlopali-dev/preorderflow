import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: "Lien de paiement de la campagne (http/https)",
  })
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  paymentLink?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentUrl?: string;
}

// Champs éditables une fois la campagne créée — jamais slug/productId, qui
// sont structurants (changer le produit d'une campagne en cours romprait
// le lien avec le recensement/les commandes déjà passés dessus).
export class UpdateCampaignDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: "Lien de paiement (null pour l'effacer)",
  })
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  paymentLink?: string | null;
}

export class UpdateCampaignStatusDto {
  @ApiProperty({
    enum: [
      "DRAFT",
      "RECENSEMENT",
      "COMMANDES_OUVERTES",
      "COMMANDES_FERMEES",
      "PRODUCTION",
      "EXPEDITION",
      "TERMINEE",
      "ANNULEE",
    ],
  })
  @IsString()
  status!:
    | "DRAFT"
    | "RECENSEMENT"
    | "COMMANDES_OUVERTES"
    | "COMMANDES_FERMEES"
    | "PRODUCTION"
    | "EXPEDITION"
    | "TERMINEE"
    | "ANNULEE";
}

// Une ligne par couleur demandée : « 2 rouges + 1 bleu » = 2 items.
export class InterestItemDto {
  @ApiProperty({ description: "Variante (couleur) du produit de la campagne" })
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateInterestDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ type: [InterestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items!: InterestItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty()
  @IsBoolean()
  consentToContact!: boolean;

  @ApiProperty({ required: false, description: "Honeypot anti-spam : doit rester vide" })
  @IsOptional()
  @IsString()
  website?: string;
}
