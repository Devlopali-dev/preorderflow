import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

// Tous les champs optionnels : un PATCH ne touche que ce qui est fourni.
// Un secret (resendApiKey/smtpPassword/ntfyAuth) omis ou vide = inchangé,
// jamais écrasé silencieusement par une valeur vide.
export class UpdateSettingsDto {
  @ApiProperty({ required: false, enum: ["console", "resend", "smtp"] })
  @IsOptional()
  @IsIn(["console", "resend", "smtp"])
  emailProvider?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  resendApiKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emailFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ntfyUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ntfyTopic?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ntfyAuth?: string;
}
