import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

export class CreatePaymentDto {
  @ApiProperty({
    enum: ["MANUAL", "BANK_TRANSFER", "STRIPE"],
    default: "MANUAL",
    description: "Choisi par l'admin/opérateur au moment de générer le paiement de la commande.",
  })
  @IsOptional()
  @IsIn(["MANUAL", "BANK_TRANSFER", "STRIPE"])
  provider?: "MANUAL" | "BANK_TRANSFER" | "STRIPE";

  @ApiProperty({ required: false, description: "Par défaut, le total de la commande" })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
