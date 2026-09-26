import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, IsUUID, NotEquals } from "class-validator";

export class CreateAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: "Positif = entrée, négatif = sortie" })
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
