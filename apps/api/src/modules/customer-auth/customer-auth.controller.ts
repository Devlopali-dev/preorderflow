import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CustomerAuthService } from "./customer-auth.service";
import { RequestMagicLinkDto, VerifyMagicLinkDto } from "./dto/customer-auth.dto";
import { Public } from "../auth/public.decorator";

@ApiTags("customer-auth")
@Public()
@Controller("customer/auth")
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  // Rate-limit strict : évite qu'un tiers spamme la boîte mail d'un client
  // en demandant des liens en boucle (CLAUDE.md §26).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("magic-link")
  async requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    await this.customerAuthService.requestMagicLink(dto.email);
    return { message: "Si un compte existe avec cet email, un lien de connexion a été envoyé." };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("magic-link/verify")
  verifyMagicLink(@Body() dto: VerifyMagicLinkDto) {
    return this.customerAuthService.verifyMagicLink(dto.token);
  }
}
