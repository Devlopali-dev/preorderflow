import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, CampaignStatus } from "@preorderflow/database";
import { CreateCampaignDto, CreateInterestDto } from "./dto/create-campaign.dto";
import { assertValidCampaignTransition, InvalidCampaignTransitionError } from "./campaign-status";
import { computeCampaignStatistics } from "./campaign-statistics";

@Injectable()
export class CampaignService {
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
      },
    });
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

    return prisma.$transaction(async (tx) => {
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
