import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// Une adresse du carnet d'un client. Sans `id` : nouvelle adresse ; avec `id` :
// mise à jour de cette adresse (qui doit appartenir au client).
export class CustomerAddressDto {
  @ApiProperty({ required: false, description: "Absent pour une nouvelle adresse" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: ["BILLING", "SHIPPING"] })
  @IsIn(["BILLING", "SHIPPING"])
  type!: "BILLING" | "SHIPPING";

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address1!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: "FR" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  country!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
