import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { prisma } from "@preorderflow/database";
import { LoginDto } from "./dto/login.dto";
import { SetupDto } from "./dto/setup.dto";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  // Premier lancement : tant qu'aucun AdminUser n'existe, l'app n'est pas
  // utilisable (aucun moyen de se connecter) — /setup crée le tout premier
  // compte ADMIN. Se ferme définitivement dès qu'un admin existe.
  async needsSetup(): Promise<boolean> {
    const count = await prisma.adminUser.count();
    return count === 0;
  }

  async setup(dto: SetupDto) {
    if (!(await this.needsSetup())) {
      throw new ConflictException("Un compte administrateur existe déjà");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await prisma.adminUser.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: "ADMIN",
        active: true,
      },
    });

    // À la création du premier compte, pré-remplir le mail de contact des
    // paramètres avec l'email saisi — sans écraser une valeur déjà configurée
    // (le singleton peut exister sans contactEmail, ex. config par migration).
    const singleton = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!singleton) {
      await prisma.appSettings.create({ data: { id: "singleton", contactEmail: dto.email } });
    } else if (!singleton.contactEmail) {
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { contactEmail: dto.email },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

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
