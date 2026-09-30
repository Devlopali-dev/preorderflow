import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class ProductionBatchItemDto {
  @ApiProperty({ description: "Variante (couleur) du produit à fabriquer" })
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityPlanned!: number;
}

export class CreateProductionBatchDto {
  @ApiProperty({
    required: false,
    description:
      "Référence du lot. Si absente : nom du premier produit + date (nom-AAAAMMJJ), suffixée #1, #2… en cas de doublon.",
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ type: [ProductionBatchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionBatchItemDto)
  items!: ProductionBatchItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductionItemDto {
  @ApiProperty()
  @IsUUID()
  productionItemId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityPlanned!: number;
}

// Reference/notes/quantités prévues uniquement — jamais les lignes elles-
// mêmes (ajouter/retirer un produit) ni quantityProduced, qui passent par
// /complete une fois le lot démarré.
export class UpdateProductionBatchDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [UpdateProductionItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductionItemDto)
  items?: UpdateProductionItemDto[];
}

export class CompleteProductionItemDto {
  @ApiProperty()
  @IsUUID()
  productionItemId!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  quantityProduced!: number;
}

export class CompleteProductionBatchDto {
  @ApiProperty({ type: [CompleteProductionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompleteProductionItemDto)
  items!: CompleteProductionItemDto[];
}

// Correction d'une production : retire des unités déjà déclarées produites.
export class DecrementProductionDto {
  @ApiProperty()
  @IsUUID()
  productionItemId!: string;

  @ApiProperty({ required: false, default: 1, description: "Unités à retirer (1 par défaut)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
