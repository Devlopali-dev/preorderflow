import { Injectable } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { computeStockSnapshot, StockSnapshot, sumStockSnapshots } from "./inventory-stock";

// Statuts de commande pour lesquels une ligne réserve du stock : dès qu'un
// paiement existe et tant que la commande n'est pas expédiée/annulée
// (cf. docs/architecture.md §5.3).
const RESERVING_ORDER_STATUSES = ["PAID", "PROCESSING", "READY_TO_SHIP"] as const;

@Injectable()
export class InventoryService {
  async getStockSnapshot(variantId: string): Promise<StockSnapshot> {
    const [movements, reservedItems] = await Promise.all([
      prisma.inventoryMovement.findMany({ where: { variantId }, select: { quantity: true } }),
      prisma.orderItem.findMany({
        where: { variantId, order: { status: { in: [...RESERVING_ORDER_STATUSES] } } },
        select: { quantity: true },
      }),
    ]);

    return computeStockSnapshot(
      movements.map((m) => m.quantity),
      reservedItems.map((i) => i.quantity),
    );
  }

  // Un élément par produit fabricable : stock total (somme des variantes) et
  // détail par variante/couleur.
  async listAll() {
    const products = await prisma.product.findMany({
      where: { manufacturable: true },
      include: { variants: { include: { color: true }, orderBy: { sku: "asc" } } },
    });
    return Promise.all(
      products.map(async ({ variants, ...product }) => {
        const variantStocks = await Promise.all(
          variants.map(async (variant) => ({
            variant,
            stock: await this.getStockSnapshot(variant.id),
          })),
        );
        return {
          product,
          stock: sumStockSnapshots(variantStocks.map((v) => v.stock)),
          variants: variantStocks,
        };
      }),
    );
  }

  async listMovements(variantId: string) {
    return prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAdjustment(variantId: string, quantity: number, reason: string) {
    return prisma.inventoryMovement.create({
      data: {
        variantId,
        quantity,
        type: quantity >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        referenceType: "MANUAL",
        reason,
      },
    });
  }
}
