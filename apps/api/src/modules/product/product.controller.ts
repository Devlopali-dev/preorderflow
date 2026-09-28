import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductService } from "./product.service";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";
import { Public } from "../auth/public.decorator";

@ApiTags("products")
@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Lecture publique : prix produit affiché sur la page vitrine de campagne.
  @Public()
  @Get()
  list() {
    return this.productService.list();
  }

  @Public()
  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string) {
    return this.productService.archive(id);
  }
}
