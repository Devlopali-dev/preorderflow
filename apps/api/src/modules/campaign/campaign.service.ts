import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, CampaignStatus } from "@preorderflow/database";
import { CreateCampaignDto, CreateInterestDto, UpdateCampaignDto } from "./dto/create-campaign.dto";
import { assertValidCampaignTransition, InvalidCampaignTransitionError } from "./campaign-status";
import { computeCampaignStatistics } from "./campaign-statistics";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class CampaignService {
  // Nombre maximal d'aperçus (photos + PDF) affichés sur la page publique.
  static readonly MAX_MEDIA = 5;

  constructor(private readonly notificationService: NotificationService) {}

  async list() {
    return prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { media: { orderBy: { position: "asc" } } },
    });
  }

  async getBySlugOrId(idOrSlug: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { media: { orderBy: { position: "asc" } } },
    });
    if (!campaign) {
      throw new NotFoundException(`Campagne "${idOrSlug}" introuvable`);
    }
    return campaign;
  }

  async create(dto: CreateCampaignDto) {
    return prisma.campaign.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        productId: dto.productId,
        indicativePrice: dto.indicativePrice,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.getBySlugOrId(id);
    return prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: dto.name,
        description: dto.description,
        indicativePrice: dto.indicativePrice,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
      },
    });
  }

  // Une campagne n'a qu'une relation entrante (CampaignInterest) — les
  // commandes sont indépendantes des campagnes par conception (§10).
  // Un vrai recensement ne doit jamais disparaître silencieusement : on
  // bloque la suppression s'il existe des intérêts, l'admin doit passer par
  // ANNULEE à la place.
  async remove(id: string) {
    const campaign = await this.getBySlugOrId(id);
    const interestCount = await prisma.campaignInterest.count({
      where: { campaignId: campaign.id },
    });
    if (interestCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ${interestCount} personne(s) ont déjà manifesté un intérêt. Utilisez le statut ANNULEE à la place.`,
      );
    }
    await prisma.campaign.delete({ where: { id: campaign.id } });
    return { id: campaign.id };
  }

  async updateStatus(id: string, status: CampaignStatus) {
    const campaign = await this.getBySlugOrId(id);
    try {
      assertValidCampaignTransition(campaign.status, status);
    } catch (error) {
      if (error instanceof InvalidCampaignTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return prisma.campaign.update({ where: { id: campaign.id }, data: { status } });
  }

  /**
   * Recensement public. Find-or-create Customer par email (décision
   * architecture §5.2) puis honeypot silencieux : si rempli, on répond
   * comme si tout allait bien sans rien créer, pour ne pas renseigner le
   * bot sur la détection.
   */
  async registerInterest(campaignSlugOrId: string, dto: CreateInterestDto) {
    if (dto.website) {
      return { id: "ignored", campaignId: campaignSlugOrId, spam: true };
    }

    const campaign = await this.getBySlugOrId(campaignSlugOrId);

    const interest = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: dto.email },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? undefined,
        },
        create: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      return tx.campaignInterest.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          quantity: dto.quantity,
          comment: dto.comment,
          consentToContact: dto.consentToContact,
        },
      });
    });

    await this.notificationService.sendEmail(dto.email, "INTEREST_REGISTERED", {
      firstName: dto.firstName,
      campaignName: campaign.name,
      quantity: dto.quantity,
    });

    return interest;
  }

  async getStatistics(campaignSlugOrId: string) {
    const campaign = await this.getBySlugOrId(campaignSlugOrId);
    const interests = await prisma.campaignInterest.findMany({
      where: { campaignId: campaign.id },
      select: { quantity: true, createdAt: true },
    });
    return computeCampaignStatistics(interests);
  }

  // Ajoute un média (photo ou PDF) à la galerie publique, en respectant la
  // limite de 5 aperçus. Retourne la campagne à jour avec sa liste media.
  async addMedia(
    campaignSlugOrId: string,
    url: string,
    type: "IMAGE" | "DOCUMENT",
    thumbnailUrl?: string,
  ) {
    const campaign = await this.getBySlugOrId(campaignSlugOrId);
    const count = await prisma.campaignMedia.count({ where: { campaignId: campaign.id } });
    if (count >= CampaignService.MAX_MEDIA) {
      throw new BadRequestException(
        `Limite de ${CampaignService.MAX_MEDIA} aperçus atteinte pour cette campagne`,
      );
    }

    await prisma.campaignMedia.create({
      data: {
        campaignId: campaign.id,
        url,
        type,
        thumbnailUrl,
        position: count,
      },
    });

    return prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: { media: { orderBy: { position: "asc" } } },
    });
  }

  // Supprime un média de la galerie puis réordonne les positions restantes
  // pour garder une suite 0..n-1 continue (affichage déterministe).
  // Retourne la campagne à jour et le média supprimé (pour nettoyage disque).
  async removeMedia(campaignSlugOrId: string, mediaId: string) {
    const campaign = await this.getBySlugOrId(campaignSlugOrId);
    const removed = await prisma.campaignMedia.findFirst({
      where: { id: mediaId, campaignId: campaign.id },
    });
    if (!removed) {
      throw new NotFoundException("Aperçu introuvable");
    }

    await prisma.campaignMedia.deleteMany({
      where: { id: mediaId, campaignId: campaign.id },
    });

    const remaining = await prisma.campaignMedia.findMany({
      where: { campaignId: campaign.id },
      orderBy: { position: "asc" },
    });
    await prisma.$transaction(
      remaining.map((media, index) =>
        prisma.campaignMedia.update({
          where: { id: media.id },
          data: { position: index },
        }),
      ),
    );

    const updatedCampaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: { media: { orderBy: { position: "asc" } } },
    });

    return { campaign: updatedCampaign, removed };
  }
}
