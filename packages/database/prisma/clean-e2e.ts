import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// Nettoyage des données laissées par la suite E2E (apps/web/e2e) dans la base de dev.
//
// Les tests créent leurs propres produits, campagnes, clients et commandes, et ne les
// suppriment pas (un produit s'archive, une commande s'annule) : la base grossit à chaque
// passage et finit par ralentir les pages (liste de 500 produits, 1 Mo de commandes…).
//
// Ce qui est supprimé, et seulement cela — les données de démo (seed) et les données réelles
// sont épargnées :
// - produits dont le SKU porte un horodatage de test (`…-1790868818563`) ou `SLUG-xxxxxxxx`,
//   leurs variantes, photos, mouvements de stock ;
// - campagnes dont le slug porte un horodatage de test, ou portant sur ces produits, avec
//   leurs demandes de recensement et aperçus ;
// - clients `@example.com` autres que les 10 clients de démo, les clients anonymisés sans
//   commande, et les commandes de ces clients ;
// - commandes de démo ajoutées par les tests (clients de démo, numéro hors 2026-0001…0011) ;
// - lots de production de test (référence à horodatage), couleurs temporaires (`Auto-…`,
//   `Inactive-…`), notifications qui s'y rapportent, journal d'audit de ces entités et des
//   comptes de démo ;
// - fichiers uploadés qu'aucune ligne ne référence plus.
//
// Usage : `pnpm --filter @preorderflow/database clean:e2e [--dry-run]`.

const SEED_CUSTOMER_EMAIL = /^client(10|[1-9])@example\.com$/;
// Comptes de démo du seed : la suite E2E se connecte avec eux.
const DEMO_ACCOUNTS = [
  "admin@preorderflow.dev",
  "operateur1@preorderflow.dev",
  "operateur2@preorderflow.dev",
];
const SEED_ORDER_NUMBERS = Array.from(
  { length: 11 },
  (_, i) => `2026-${String(i + 1).padStart(4, "0")}`,
);

// Lit DATABASE_URL dans l'environnement, à défaut dans le .env racine (cette seule clé).
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = resolve(__dirname, "../../../.env");
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line)
      return line
        .slice("DATABASE_URL=".length)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL introuvable (environnement ou .env racine)");
}

export interface CleanReport {
  products: number;
  variants: number;
  campaigns: number;
  customers: number;
  orders: number;
  productionBatches: number;
  colors: number;
  notifications: number;
  auditLogs: number;
  files: number;
}

export async function cleanE2eData({ dryRun = false } = {}): Promise<CleanReport> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  try {
    const ids = async (query: Promise<Array<{ id: string }>>) => (await query).map((row) => row.id);

    const productIds = await ids(
      prisma.$queryRaw`SELECT id FROM products WHERE sku ~ '-[0-9]{13}' OR sku ~ '^SLUG-[a-z0-9]{8}$'`,
    );
    const variantIds = (
      await prisma.productVariant.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      })
    ).map((v) => v.id);

    const campaignIds = await ids(
      prisma.$queryRaw`SELECT id FROM campaigns WHERE slug ~ '-[0-9]{13}'`,
    ).then(async (bySlug) => [
      ...new Set([
        ...bySlug,
        ...(
          await prisma.campaign.findMany({
            where: { productId: { in: productIds } },
            select: { id: true },
          })
        ).map((c) => c.id),
      ]),
    ]);

    const customers = await prisma.customer.findMany({ select: { id: true, email: true } });
    const testCustomerIds = customers
      .filter((c) => c.email.endsWith("@example.com") && !SEED_CUSTOMER_EMAIL.test(c.email))
      .map((c) => c.id);
    const demoCustomerIds = customers
      .filter((c) => SEED_CUSTOMER_EMAIL.test(c.email))
      .map((c) => c.id);

    // Clients anonymisés (par un test RGPD) qui n'ont jamais rien payé : sans commande, ou avec
    // seulement des brouillons. Un client anonymisé qui a des commandes réglées est gardé
    // (comptabilité).
    const anonymizedIds = (
      await prisma.customer.findMany({
        where: {
          email: { endsWith: "@anonymise.invalid" },
          orders: { none: { status: { not: "DRAFT" } } },
        },
        select: { id: true },
      })
    ).map((c) => c.id);
    const customerIds = [...new Set([...testCustomerIds, ...anonymizedIds])];

    // Commandes : celles des clients de test, celles sur des produits de test, et celles que
    // les tests ont ajoutées aux clients de démo (numéro hors du jeu de démo).
    const orderIds = (
      await prisma.order.findMany({
        where: {
          OR: [
            { customerId: { in: customerIds } },
            { items: { some: { variantId: { in: variantIds } } } },
            { campaignId: { in: campaignIds } },
            { customerId: { in: demoCustomerIds }, number: { notIn: SEED_ORDER_NUMBERS } },
          ],
        },
        select: { id: true },
      })
    ).map((o) => o.id);
    const orderRows = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { number: true },
    });

    const batchIds = await ids(
      prisma.$queryRaw`SELECT id FROM production_batches WHERE reference ~ '-[0-9]{13}'`,
    ).then(async (byRef) => [
      ...new Set([
        ...byRef,
        ...(
          await prisma.productionBatch.findMany({
            where: { items: { some: { variantId: { in: variantIds } } } },
            select: { id: true },
          })
        ).map((b) => b.id),
      ]),
    ]);

    const campaignNames = (
      await prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { name: true } })
    ).map((c) => c.name);
    const shipmentIds = (
      await prisma.shipment.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    ).map((s) => s.id);

    const entityIds = [
      ...orderIds,
      ...customerIds,
      ...productIds,
      ...campaignIds,
      ...batchIds,
      ...shipmentIds,
    ];

    // Notifications : e-mails à des adresses de test, et alertes admin qui citent une commande
    // ou une campagne supprimée.
    const alerts = await prisma.notification.findMany({
      where: { template: "ADMIN_ALERT" },
      select: { id: true, payload: true },
    });
    const needles = [...orderRows.map((o) => o.number), ...campaignNames];
    const alertIds = alerts
      .filter((a) => {
        const text = JSON.stringify(a.payload ?? {});
        return needles.some((needle) => needle && text.includes(needle));
      })
      .map((a) => a.id);
    const mailIds = (
      await prisma.notification.findMany({
        where: { recipient: { endsWith: "@example.com" } },
        select: { id: true },
      })
    ).map((n) => n.id);
    const notificationIds = [...new Set([...alertIds, ...mailIds])];

    const colorIds = await ids(
      prisma.$queryRaw`SELECT c.id FROM colors c WHERE c.name ~ '^(Auto|Inactive)-[0-9]+'
        AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v."colorId" = c.id)`,
    );

    // Journal d'audit : lignes qui portent sur une entité supprimée, et actions des comptes de démo
    // (que la suite E2E utilise ; le seed n'écrit aucune ligne d'audit).
    const auditIds = (
      await prisma.auditLog.findMany({
        where: {
          OR: [{ entityId: { in: entityIds } }, { user: { email: { in: DEMO_ACCOUNTS } } }],
        },
        select: { id: true },
      })
    ).map((a) => a.id);

    const report: CleanReport = {
      products: productIds.length,
      variants: variantIds.length,
      campaigns: campaignIds.length,
      customers: customerIds.length,
      orders: orderIds.length,
      productionBatches: batchIds.length,
      colors: colorIds.length,
      notifications: notificationIds.length,
      auditLogs: auditIds.length,
      files: 0,
    };

    if (!dryRun) {
      // Dans l'ordre des dépendances : lignes filles d'abord.
      await prisma.$transaction([
        prisma.shipmentEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } }),
        prisma.shipment.deleteMany({ where: { id: { in: shipmentIds } } }),
        prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
        prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
        prisma.inventoryMovement.deleteMany({
          where: {
            OR: [
              { variantId: { in: variantIds } },
              { referenceType: "ORDER", referenceId: { in: orderIds } },
              { referenceType: "PRODUCTION_BATCH", referenceId: { in: batchIds } },
            ],
          },
        }),
        prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
        prisma.productionItem.deleteMany({
          where: {
            OR: [{ productionBatchId: { in: batchIds } }, { variantId: { in: variantIds } }],
          },
        }),
        prisma.productionBatch.deleteMany({ where: { id: { in: batchIds } } }),
        prisma.campaignInterestItem.deleteMany({
          where: {
            OR: [
              { variantId: { in: variantIds } },
              { interest: { campaignId: { in: campaignIds } } },
              { interest: { customerId: { in: customerIds } } },
            ],
          },
        }),
        prisma.campaignInterest.deleteMany({
          where: { OR: [{ campaignId: { in: campaignIds } }, { customerId: { in: customerIds } }] },
        }),
        prisma.campaignMedia.deleteMany({ where: { campaignId: { in: campaignIds } } }),
        prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } }),
        prisma.address.deleteMany({ where: { customerId: { in: customerIds } } }),
        prisma.customer.deleteMany({ where: { id: { in: customerIds } } }),
        prisma.productPhoto.deleteMany({ where: { productId: { in: productIds } } }),
        prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } }),
        prisma.product.deleteMany({ where: { id: { in: productIds } } }),
        prisma.color.deleteMany({ where: { id: { in: colorIds } } }),
        prisma.notification.deleteMany({ where: { id: { in: notificationIds } } }),
        prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } }),
      ]);
    }

    report.files = await removeOrphanUploads(prisma, dryRun);
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

// Fichiers de apps/api/uploads/{products,campaigns} qu'aucune ligne ne référence plus (photos de
// produits et aperçus de campagne supprimés, ou laissés par une base réinitialisée).
async function removeOrphanUploads(prisma: PrismaClient, dryRun: boolean): Promise<number> {
  const uploadsRoot = resolve(__dirname, "../../../apps/api/uploads");
  if (!existsSync(uploadsRoot)) return 0;

  const referenced = new Set<string>();
  const add = (url: string | null | undefined) =>
    url && referenced.add(url.replace(/^\/uploads\//, ""));
  (await prisma.productPhoto.findMany({ select: { url: true } })).forEach((p) => add(p.url));
  (await prisma.campaignMedia.findMany({ select: { url: true, thumbnailUrl: true } })).forEach(
    (m) => {
      add(m.url);
      add(m.thumbnailUrl);
    },
  );
  (await prisma.campaign.findMany({ select: { imageUrl: true, documentUrl: true } })).forEach(
    (c) => {
      add(c.imageUrl);
      add(c.documentUrl);
    },
  );

  let removed = 0;
  for (const folder of ["products", "campaigns"]) {
    const dir = join(uploadsRoot, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (file.startsWith(".")) continue; // .gitkeep
      if (referenced.has(`${folder}/${file}`)) continue;
      removed += 1;
      if (!dryRun) unlinkSync(join(dir, file));
    }
  }
  return removed;
}

// CLI : `tsx prisma/clean-e2e.ts [--dry-run]`
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  cleanE2eData({ dryRun })
    .then((report) => {
      console.log(
        dryRun ? "Simulation (rien n'est supprimé) :" : "Données de test supprimées :",
        report,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
