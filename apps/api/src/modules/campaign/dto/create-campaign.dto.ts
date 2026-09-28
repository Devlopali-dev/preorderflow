import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  indicativePrice!: number;

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
  @IsNumber()
  @Min(0)
  indicativePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
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

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

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
