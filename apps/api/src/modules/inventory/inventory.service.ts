import { Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { computeStockSnapshot, StockSnapshot } from "./inventory-stock";

// Statuts de commande pour lesquels une ligne réserve du stock : dès qu'un
// paiement existe et tant que la commande n'est pas expédiée/annulée
// (cf. docs/architecture.md §5.3).
const RESERVING_ORDER_STATUSES = ["PAID", "PROCESSING", "READY_TO_SHIP"] as const;

@Injectable()
export class InventoryService {
  async getStockSnapshot(productId: string): Promise<StockSnapshot> {
    const [movements, reservedItems] = await Promise.all([
      prisma.inventoryMovement.findMany({ where: { productId }, select: { quantity: true } }),
      prisma.orderItem.findMany({
        where: { productId, order: { status: { in: [...RESERVING_ORDER_STATUSES] } } },
        select: { quantity: true },
      }),
    ]);

    return computeStockSnapshot(
      movements.map((m) => m.quantity),
      reservedItems.map((i) => i.quantity),
    );
  }

  async listAll() {
    const products = await prisma.product.findMany({ where: { manufacturable: true } });
    return Promise.all(
      products.map(async (product) => ({
        product,
        stock: await this.getStockSnapshot(product.id),
      })),
    );
  }

  async listMovements(productId: string) {
    return prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAdjustment(productId: string, quantity: number, reason: string) {
    return prisma.inventoryMovement.create({
      data: {
        productId,
        quantity,
        type: quantity >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        referenceType: "MANUAL",
        reason,
      },
    });
  }
}
