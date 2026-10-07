import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CampaignService } from "./campaign.service";
import { CreatePublicOrderDto } from "./dto/create-public-order.dto";
import { saveAddressIfNone } from "../customer/address-book";
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

    // Un brouillon est introuvable (404) pour un visiteur, comme sur sa page.
    const campaign = await this.campaignService.getVisibleBySlugOrId(campaignSlugOrId);
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

    // Livraison désactivée sur la campagne : remise en main propre uniquement.
    const shippingEnabled = campaign.shippingEnabled;
    const deliveryMethod = dto.deliveryMethod ?? (shippingEnabled ? "SHIPPING" : "PICKUP");
    if (deliveryMethod === "SHIPPING" && !shippingEnabled) {
      throw new BadRequestException(
        "La livraison n'est pas proposée : remise en main propre uniquement",
      );
    }
    const paymentMethod = dto.paymentMethod ?? "ONLINE";
    // Payer en liquide « à la réception » suppose une remise en main propre.
    if (paymentMethod === "CASH" && deliveryMethod !== "PICKUP") {
      throw new BadRequestException(
        "Le paiement en liquide n'est possible qu'en remise en main propre",
      );
    }

    const order = await this.orderService.create(
      {
        customerEmail: dto.email,
        customerFirstName: dto.firstName,
        customerLastName: dto.lastName,
        customerPhone: dto.phone,
        items: dto.items,
        deliveryMethod,
        carrier: dto.carrier,
        shippingAddress: dto.shippingAddress && {
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

    // L'adresse remonte dans le carnet du client (donc dans l'admin), sans jamais modifier un
    // client qui en a déjà une.
    if (dto.shippingAddress) {
      await saveAddressIfNone(order.customerId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        ...dto.shippingAddress,
      });
    }

    // En ligne : règlement manuel avec lien Revolut. En liquide : règlement CASH sans lien,
    // encaissé et confirmé par l'admin à la remise.
    const payment = await this.paymentService.createForOrder(order.id, {
      provider: paymentMethod === "CASH" ? "CASH" : "MANUAL",
    });
    const metadata = payment.metadata as { paymentLink?: string } | null;
    return {
      orderNumber: order.number,
      total: order.total.toFixed(2),
      currency: order.currency,
      paymentMethod,
      paymentLink: paymentMethod === "CASH" ? null : (metadata?.paymentLink ?? null),
    };
  }
}
