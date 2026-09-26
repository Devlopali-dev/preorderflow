import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";

export class ProductionBatchItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityPlanned!: number;
}

export class CreateProductionBatchDto {
  @ApiProperty()
  @IsString()
  reference!: string;

  @ApiProperty({ type: [ProductionBatchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionBatchItemDto)
  items!: ProductionBatchItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteProductionItemDto {
  @ApiProperty()
  @IsUUID()
  productionItemId!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  quantityProduced!: number;
}

export class CompleteProductionBatchDto {
  @ApiProperty({ type: [CompleteProductionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompleteProductionItemDto)
  items!: CompleteProductionItemDto[];
}
