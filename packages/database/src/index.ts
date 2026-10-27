import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 se connecte via un adaptateur de pilote (plus de moteur Rust embarqué). Le paramètre
// `?schema=` de l'URL Prisma n'est pas compris par `pg` : on le retire de l'URL et on le passe à
// l'adaptateur. Défini ici et non dans un fichier voisin : l'API charge ce module en TypeScript
// natif (ESM), où un import relatif sans extension ne se résout pas.
export function createAdapter(connectionString: string | undefined = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL n'est pas défini");
  }
  const url = new URL(connectionString);
  const schema = url.searchParams.get("schema") ?? undefined;
  url.searchParams.delete("schema");
  return new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined);
}

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    adapter: createAdapter(),
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
