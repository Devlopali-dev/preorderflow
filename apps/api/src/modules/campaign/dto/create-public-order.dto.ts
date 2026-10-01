import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class PublicOrderItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class PublicOrderAddressDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  address1!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2)
  country!: string;
}

// Commande passée depuis la page publique d'une campagne dont les commandes sont ouvertes.
export class CreatePublicOrderDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ type: [PublicOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];

  @ApiProperty({ type: PublicOrderAddressDto })
  @ValidateNested()
  @Type(() => PublicOrderAddressDto)
  shippingAddress!: PublicOrderAddressDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false, description: "Honeypot anti-spam : doit rester vide" })
  @IsOptional()
  @IsString()
  website?: string;
}
