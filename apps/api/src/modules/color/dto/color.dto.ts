import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class CreateColorDto {
  @ApiProperty({ example: "Rouge" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @ApiProperty({ example: "#d62828", description: "Couleur de la pastille, format #rrggbb" })
  @Matches(HEX_COLOR, { message: "hex doit être au format #rrggbb" })
  hex!: string;
}

export class UpdateColorDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(HEX_COLOR, { message: "hex doit être au format #rrggbb" })
  hex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
