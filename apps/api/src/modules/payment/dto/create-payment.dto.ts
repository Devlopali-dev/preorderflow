import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

export class CreatePaymentDto {
  @ApiProperty({ enum: ["MANUAL", "BANK_TRANSFER"], default: "MANUAL" })
  @IsOptional()
  @IsIn(["MANUAL", "BANK_TRANSFER"])
  provider?: "MANUAL" | "BANK_TRANSFER";

  @ApiProperty({ required: false, description: "Par défaut, le total de la commande" })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
