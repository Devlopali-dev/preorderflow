import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsUUID } from "class-validator";

export class CreateVariantDto {
  @ApiProperty({
    description: "Couleur de la palette globale (/colors) à proposer pour ce produit",
  })
  @IsUUID()
  colorId!: string;
}

export class UpdateVariantDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}
