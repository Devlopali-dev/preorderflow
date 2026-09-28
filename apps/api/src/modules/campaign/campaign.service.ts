import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, CampaignStatus } from "@preorderflow/database";
import { CreateCampaignDto, CreateInterestDto, UpdateCampaignDto } from "./dto/create-campaign.dto";
import { assertValidCampaignTransition, InvalidCampaignTransitionError } from "./campaign-status";
import { computeCampaignStatistics } from "./campaign-statistics";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class CampaignService {
  constructor(private readonly notificationService: NotificationService) {}

  async list() {
    return prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getBySlugOrId(idOrSlug: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
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
}
