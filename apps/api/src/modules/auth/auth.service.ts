import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { prisma } from "@preorderflow/database";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(dto: LoginDto) {
    const user = await prisma.adminUser.findUnique({ where: { email: dto.email } });

    // Même message que l'utilisateur existe ou non — ne pas renseigner un
    // attaquant sur la validité d'un email (CLAUDE.md §26).
    const invalid = () => new UnauthorizedException("Email ou mot de passe incorrect");

    if (!user || !user.active) {
      throw invalid();
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw invalid();
    }

    // secret + expiresIn viennent de JwtModule.registerAsync (auth.module.ts).
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
