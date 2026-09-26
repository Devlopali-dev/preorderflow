import { Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";

@Injectable()
export class DashboardService {
  async getOverview() {
    const [
      activeCampaigns,
      totalInterests,
      totalOrders,
      ordersToPay,
      ordersToPrepare,
      ordersToShip,
      productionInProgress,
      shipmentsInTransit,
    ] = await Promise.all([
      prisma.campaign.count({
        where: { status: { in: ["RECENSEMENT", "COMMANDES_OUVERTES", "PRODUCTION", "EXPEDITION"] } },
      }),
      prisma.campaignInterest.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: "READY_TO_SHIP" } }),
      prisma.productionBatch.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
      prisma.shipment.count({ where: { status: { in: ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } } }),
    ]);

    return {
      activeCampaigns,
      totalInterests,
      totalOrders,
      ordersToPay,
      ordersToPrepare,
      ordersToShip,
      productionInProgress,
      shipmentsInTransit,
    };
  }
}
