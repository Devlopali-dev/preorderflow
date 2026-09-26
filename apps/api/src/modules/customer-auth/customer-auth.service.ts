import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { prisma } from "@preorderflow/database";
import { NotificationService } from "../notification/notification.service";
import { MagicLinkPayload } from "./customer-jwt-payload";

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Toujours un succès générique, même si l'email est inconnu — ne jamais
   * révéler l'existence d'un compte (CLAUDE.md §26). Si le client existe,
   * un email avec un lien à usage limité dans le temps est envoyé.
   */
  async requestMagicLink(email: string): Promise<void> {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      return;
    }

    const expiresIn = this.configService.get<string>("MAGIC_LINK_EXPIRES_IN") ?? "15m";
    const magicLinkSecret = this.configService.get<string>("MAGIC_LINK_SECRET");

    const payload: MagicLinkPayload = { sub: customer.id, type: "magic-link" };
    const token = this.jwtService.sign(payload, { secret: magicLinkSecret, expiresIn });

    const webUrl = this.configService.get<string>("WEB_URL") ?? "http://localhost:3000";
    const magicLinkUrl = `${webUrl}/mon-compte/verifier?token=${token}`;

    await this.notificationService.sendEmail(customer.email, "CUSTOMER_MAGIC_LINK", {
      firstName: customer.firstName,
      magicLinkUrl,
      expiresInMinutes: parseExpiresInMinutes(expiresIn),
    });
  }

  async verifyMagicLink(token: string) {
    const magicLinkSecret = this.configService.get<string>("MAGIC_LINK_SECRET");

    let payload: MagicLinkPayload;
    try {
      payload = this.jwtService.verify<MagicLinkPayload>(token, { secret: magicLinkSecret });
    } catch {
      throw new UnauthorizedException("Lien de connexion invalide ou expiré");
    }
    if (payload.type !== "magic-link") {
      throw new UnauthorizedException("Lien de connexion invalide ou expiré");
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer) {
      throw new NotFoundException("Client introuvable");
    }

    // Session client de 7 jours — signée avec le secret applicatif par
    // défaut (JwtModule), distinct du secret du lien magique éphémère.
    const accessToken = this.jwtService.sign(
      { sub: customer.id, type: "customer" },
      { expiresIn: "7d" },
    );

    return {
      accessToken,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    };
  }
}

function parseExpiresInMinutes(expiresIn: string): number {
  const match = /^(\d+)m$/.exec(expiresIn);
  return match ? Number(match[1]) : 15;
}
