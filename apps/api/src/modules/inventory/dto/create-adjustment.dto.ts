import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, IsUUID, NotEquals } from "class-validator";

export class CreateAdjustmentDto {
  @ApiProperty({ description: "Variante (couleur) du produit dont le stock est ajusté" })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ description: "Positif = entrée, négatif = sortie" })
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
