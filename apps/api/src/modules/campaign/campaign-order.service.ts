import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CampaignService } from "./campaign.service";
import { CreatePublicOrderDto } from "./dto/create-public-order.dto";
import { OrderService } from "../order/order.service";
import { PaymentService } from "../payment/payment.service";

// Commande publique : quand les commandes d'une campagne sont ouvertes, le formulaire de sa
// page devient un formulaire d'achat. La commande est créée, puis son règlement manuel est
// généré (lien Revolut avec le montant, celui de la campagne ou du .env) : la commande passe
// en attente de paiement, l'admin vérifie ensuite le virement à la main.
@Injectable()
export class CampaignOrderService {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  async create(campaignSlugOrId: string, dto: CreatePublicOrderDto) {
    // Honeypot : on répond comme si tout allait bien, sans rien créer, pour ne pas renseigner le bot.
    if (dto.website) {
      return { ignored: true as const };
    }

    const campaign = await this.campaignService.getBySlugOrId(campaignSlugOrId);
    if (campaign.status !== "COMMANDES_OUVERTES") {
      throw new BadRequestException("Les commandes de cette campagne ne sont pas ouvertes");
    }

    // Chaque ligne vise une variante active du produit de la campagne, une seule fois.
    const variantIds = dto.items.map((item) => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      throw new BadRequestException("Une couleur ne peut apparaître qu'une seule fois");
    }
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, productId: campaign.productId, active: true },
      select: { id: true },
    });
    if (variants.length !== variantIds.length) {
      throw new BadRequestException("Couleur inconnue pour cette campagne");
    }

    const order = await this.orderService.create(
      {
        customerEmail: dto.email,
        customerFirstName: dto.firstName,
        customerLastName: dto.lastName,
        customerPhone: dto.phone,
        items: dto.items,
        shippingAddress: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          ...dto.shippingAddress,
          phone: dto.phone,
        },
        notes: dto.notes,
        campaignId: campaign.id,
      },
      // Formulaire anonyme : il ne doit jamais réécrire la fiche d'un client existant.
      { keepExistingCustomer: true },
    );

    const payment = await this.paymentService.createForOrder(order.id, { provider: "MANUAL" });
    const metadata = payment.metadata as { paymentLink?: string } | null;
    return {
      orderNumber: order.number,
      total: order.total.toFixed(2),
      currency: order.currency,
      paymentLink: metadata?.paymentLink ?? null,
    };
  }
}
