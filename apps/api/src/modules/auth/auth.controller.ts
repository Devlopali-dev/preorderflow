import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SetupDto } from "./dto/setup.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CurrentAdminId } from "./current-admin.decorator";
import { Public } from "./public.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate-limit strict pour ralentir le brute-force (CLAUDE.md §26).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  me(@CurrentAdminId() adminId: string) {
    return this.authService.getProfile(adminId);
  }

  @Patch("me")
  updateMe(@CurrentAdminId() adminId: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(adminId, dto);
  }

  @Public()
  @Get("setup-status")
  async setupStatus() {
    return { needsSetup: await this.authService.needsSetup() };
  }

  // Même throttle que /login : crée un compte, donc surface de brute-force
  // similaire tant qu'elle reste active (se ferme dès needsSetup = false).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("setup")
  setup(@Body() dto: SetupDto) {
    return this.authService.setup(dto);
  }
}
