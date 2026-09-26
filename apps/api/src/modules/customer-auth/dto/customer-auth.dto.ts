import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RequestMagicLinkDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class VerifyMagicLinkDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  token!: string;
}

export class UpdateCustomerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
