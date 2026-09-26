import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductService } from "./product.service";

@ApiTags("products")
@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list() {
    return this.productService.list();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productService.getById(id);
  }
}
