import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, CampaignStatus } from "@preorderflow/database";
import { CreateCampaignDto, CreateInterestDto, UpdateCampaignDto } from "./dto/create-campaign.dto";
import {
  assertValidCampaignTransition,
  InvalidCampaignTransitionError,
  isArchivedStatus,
} from "./campaign-status";
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
      include: {
        media: { orderBy: { position: "asc" } },
        // Couleurs proposées sur la page publique : données d'affichage
        // uniquement (jamais de stock ni de SKU).
        product: {
          select: {
            // Prix affiché sur la page publique : celui du produit, source unique.
            price: true,
            currency: true,
            variants: {
              where: { active: true },
              orderBy: { sku: "asc" },
              select: { id: true, color: { select: { name: true, hex: true } } },
            },
          },
        },
      },
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
        paymentLink: dto.paymentLink ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
      },
    });
  }

  // Une campagne archivée (terminée ou annulée) est en lecture seule : il faut
  // la réactiver (retour en brouillon) avant de la modifier.
  private assertEditable(campaign: { status: CampaignStatus }) {
    if (isArchivedStatus(campaign.status)) {
      throw new BadRequestException(
        "Cette campagne est archivée et en lecture seule : réactivez-la pour la modifier",
      );
    }
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.getBySlugOrId(id);
    this.assertEditable(campaign);
    return prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: dto.name,
        description: dto.description,
        // null efface le lien, undefined ne le touche pas.
        paymentLink: dto.paymentLink,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        imageUrl: dto.imageUrl,
        documentUrl: dto.documentUrl,
      },
    });
  }

  // Les commandes sont indépendantes des campagnes par conception (§10) : seules
  // les demandes de recensement (CampaignInterest) et les médias en dépendent.
  //
  // Un vrai recensement ne doit jamais disparaître par accident :
  // - une campagne en cours qui a des demandes ne se supprime pas, il faut
  //   d'abord l'annuler ;
  // - une campagne archivée (terminée ou annulée) se supprime définitivement,
  //   avec ses demandes de recensement (les clients, eux, restent : ils peuvent
  //   avoir des commandes). Les données de recensement se suppriment
  //   indépendamment des commandes (§24).
  // Renvoie les fichiers à retirer du disque : l'appelant s'en charge.
  async remove(id: string) {
    const campaign = await this.getBySlugOrId(id);
    const interestCount = await prisma.campaignInterest.count({
      where: { campaignId: campaign.id },
    });
    if (interestCount > 0 && !isArchivedStatus(campaign.status)) {
      throw new BadRequestException(
        `Impossible de supprimer : ${interestCount} personne(s) ont déjà manifesté un intérêt. Annulez la campagne, puis supprimez-la depuis les archives.`,
      );
    }

    const files = campaign.media
      .flatMap((media) => [media.url, media.thumbnailUrl])
      .filter((url): url is string => Boolean(url));

    await prisma.$transaction([
      // Les lignes de chaque demande (CampaignInterestItem) suivent en cascade.
      prisma.campaignInterest.deleteMany({ where: { campaignId: campaign.id } }),
      prisma.campaignMedia.deleteMany({ where: { campaignId: campaign.id } }),
      prisma.campaign.delete({ where: { id: campaign.id } }),
    ]);
    return { id: campaign.id, name: campaign.name, deletedInterests: interestCount, files };
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
    if (isArchivedStatus(campaign.status)) {
      throw new BadRequestException("Cette campagne est archivée : le recensement est fermé");
    }

    // Chaque ligne doit viser une variante active du produit de la campagne,
    // une seule fois (« 2 rouges + 1 bleu » = 2 lignes, jamais 2 × rouge).
    const variantIds = dto.items.map((item) => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      throw new BadRequestException("Une couleur ne peut apparaître qu'une seule fois");
    }
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, productId: campaign.productId, active: true },
      include: { color: true },
    });
    if (variants.length !== variantIds.length) {
      throw new BadRequestException("Couleur inconnue pour cette campagne");
    }
    const totalQuantity = dto.items.reduce((sum, item) => sum + item.quantity, 0);
    const hasColors = variants.some((variant) => variant.color);
    const details = hasColors
      ? ` (${dto.items
          .map((item) => {
            const color = variants.find((v) => v.id === item.variantId)?.color;
            return `${item.quantity} × ${color?.name ?? "Standard"}`;
          })
          .join(", ")})`
      : "";

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
          comment: dto.comment,
          consentToContact: dto.consentToContact,
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          },
        },
      });
    });

    await this.notificationService.sendEmail(dto.email, "INTEREST_REGISTERED", {
      firstName: dto.firstName,
      campaignName: campaign.name,
      quantity: totalQuantity,
      details,
    });

    return interest;
  }

  async getStatistics(campaignSlugOrId: string) {
    const campaign = await this.getBySlugOrId(campaignSlugOrId);
    const interests = await prisma.campaignInterest.findMany({
      where: { campaignId: campaign.id },
      select: {
        createdAt: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
            variant: { select: { color: { select: { name: true } } } },
          },
        },
      },
    });
    return computeCampaignStatistics(
      interests.map((interest) => ({
        createdAt: interest.createdAt,
        quantity: interest.items.reduce((sum, item) => sum + item.quantity, 0),
        items: interest.items.map((item) => ({
          variantId: item.variantId,
          label: item.variant.color?.name ?? "Standard",
          quantity: item.quantity,
        })),
      })),
    );
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
    this.assertEditable(campaign);
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
    this.assertEditable(campaign);
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
