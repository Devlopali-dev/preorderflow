import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// `export * from "@prisma/client"` casse la détection des exports nommés
// locaux (ex: `prisma` ci-dessus disparaît) sous le require()-of-ESM natif
// de Node quand ce fichier est chargé tel quel (sans étape de build) par
// NestJS. On ré-exporte donc explicitement les valeurs et types utiles.
export { PrismaClient, Prisma } from "@prisma/client";
export type * from "@prisma/client";
export {
  AdminRole,
  CampaignStatus,
  CampaignMediaType,
  AddressType,
  OrderStatus,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
  PaymentProvider,
  PaymentStatus,
  ProductionBatchStatus,
  InventoryMovementType,
  InventoryReferenceType,
  ShipmentStatus,
  NotificationChannel,
  NotificationTemplate,
  NotificationStatus,
  AuditAction,
} from "@prisma/client";
