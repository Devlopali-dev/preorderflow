import { Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";

// Campagnes « actives » : mêmes statuts pour la carte des campagnes et celle du recensement.
const ACTIVE_CAMPAIGN_STATUSES = [
  "RECENSEMENT",
  "COMMANDES_OUVERTES",
  "PRODUCTION",
  "EXPEDITION",
] as const;

@Injectable()
export class DashboardService {
  async getOverview() {
    const interestsOfActiveCampaigns = {
      campaign: { status: { in: [...ACTIVE_CAMPAIGN_STATUSES] } },
    };
    const [
      activeCampaigns,
      totalInterests,
      interestPeople,
      interestQuantity,
      totalOrders,
      ordersToPay,
      ordersToPrepare,
      ordersToShip,
      productionInProgress,
      shipmentsInTransit,
    ] = await Promise.all([
      prisma.campaign.count({ where: { status: { in: [...ACTIVE_CAMPAIGN_STATUSES] } } }),
      // Recensement des campagnes actives seulement : une campagne archivée ne
      // doit plus gonfler le compteur. Demandes, personnes distinctes, exemplaires.
      prisma.campaignInterest.count({ where: interestsOfActiveCampaigns }),
      prisma.campaignInterest
        .findMany({
          where: interestsOfActiveCampaigns,
          distinct: ["customerId"],
          select: { customerId: true },
        })
        .then((rows) => rows.length),
      prisma.campaignInterestItem.aggregate({
        where: { interest: interestsOfActiveCampaigns },
        _sum: { quantity: true },
      }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: "READY_TO_SHIP" } }),
      prisma.productionBatch.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
      prisma.shipment.count({
        where: { status: { in: ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } },
      }),
    ]);

    return {
      activeCampaigns,
      totalInterests,
      interestPeople,
      interestQuantity: interestQuantity._sum.quantity ?? 0,
      totalOrders,
      ordersToPay,
      ordersToPrepare,
      ordersToShip,
      productionInProgress,
      shipmentsInTransit,
    };
  }
}
