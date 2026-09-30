import { PrismaClient, InventoryMovementType, InventoryReferenceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Répartition des 100 stylos produits par couleur (Rouge, Bleu, Noir).
const PRODUCED_PER_COLOR = [40, 30, 30];

async function main() {
  // --- Admins / opérateurs ---
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.adminUser.upsert({
    where: { email: "admin@preorderflow.dev" },
    update: {},
    create: {
      email: "admin@preorderflow.dev",
      passwordHash,
      firstName: "Alice",
      lastName: "Admin",
      role: "ADMIN",
    },
  });

  const operators = await Promise.all(
    ["operateur1@preorderflow.dev", "operateur2@preorderflow.dev"].map((email, i) =>
      prisma.adminUser.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash,
          firstName: `Operateur${i + 1}`,
          lastName: "Test",
          role: "OPERATOR",
        },
      }),
    ),
  );

  // --- Produits ---
  const stylo = await prisma.product.upsert({
    where: { sku: "STYLO-001" },
    update: {},
    create: {
      sku: "STYLO-001",
      name: "Stylo",
      slug: "stylo",
      description: "Stylo de sécurité, fabrication en petite série.",
      price: 5,
      currency: "EUR",
      taxRate: 20,
      weight: 0.02,
      active: true,
      manufacturable: true,
    },
  });

  const gourde = await prisma.product.upsert({
    where: { sku: "GOURDE-001" },
    update: {},
    create: {
      sku: "GOURDE-001",
      name: "Gourde inox 500ml",
      slug: "gourde-inox-500",
      description: "Gourde réutilisable, production locale.",
      price: 15,
      currency: "EUR",
      taxRate: 20,
      weight: 0.3,
      active: true,
      manufacturable: true,
    },
  });

  const _tote = await prisma.product.upsert({
    where: { sku: "TOTE-001" },
    update: {},
    create: {
      sku: "TOTE-001",
      name: "Tote bag coton bio",
      slug: "tote-bag-coton-bio",
      description: "Sac en coton bio, sérigraphie locale.",
      price: 8,
      currency: "EUR",
      taxRate: 20,
      weight: 0.1,
      active: true,
      manufacturable: true,
    },
  });

  // --- Couleurs (palette globale) et variantes ---
  const colors = await Promise.all(
    [
      { name: "Rouge", hex: "#d62828" },
      { name: "Bleu", hex: "#1d4ed8" },
      { name: "Noir", hex: "#111111" },
    ].map((color) =>
      prisma.color.upsert({ where: { name: color.name }, update: {}, create: color }),
    ),
  );

  // Stylo : une variante par couleur. Gourde et tote : variante par défaut
  // (sans couleur, sku repris du produit).
  const styloVariants = await Promise.all(
    colors.map((color) =>
      prisma.productVariant.upsert({
        where: { sku: `STYLO-001-${color.name.toUpperCase()}` },
        update: {},
        create: {
          productId: stylo.id,
          colorId: color.id,
          sku: `STYLO-001-${color.name.toUpperCase()}`,
        },
      }),
    ),
  );
  const gourdeVariant = await prisma.productVariant.upsert({
    where: { sku: "GOURDE-001" },
    update: {},
    create: { productId: gourde.id, sku: "GOURDE-001" },
  });
  await prisma.productVariant.upsert({
    where: { sku: "TOTE-001" },
    update: {},
    create: { productId: _tote.id, sku: "TOTE-001" },
  });

  // --- Campagnes ---
  const campaign1 = await prisma.campaign.upsert({
    where: { slug: "stylo-1" },
    update: {},
    create: {
      name: "Stylo #1",
      slug: "stylo-1",
      description: "Première campagne de recensement et de vente du stylo.",
      status: "COMMANDES_OUVERTES",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-01"),
      productId: stylo.id,
      indicativePrice: 5,
      currency: "EUR",
    },
  });

  const campaign2 = await prisma.campaign.upsert({
    where: { slug: "gourde-inox-1" },
    update: {},
    create: {
      name: "Gourde inox #1",
      slug: "gourde-inox-1",
      description: "Campagne de recensement pour la gourde inox.",
      status: "RECENSEMENT",
      startDate: new Date("2026-02-01"),
      productId: gourde.id,
      indicativePrice: 15,
      currency: "EUR",
    },
  });

  // --- Clients ---
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    const customer = await prisma.customer.upsert({
      where: { email: `client${i}@example.com` },
      update: {},
      create: {
        email: `client${i}@example.com`,
        firstName: `Prenom${i}`,
        lastName: `Nom${i}`,
        phone: `060000000${i}`,
      },
    });
    customers.push(customer);

    await prisma.address.create({
      data: {
        customerId: customer.id,
        type: "SHIPPING",
        firstName: `Prenom${i}`,
        lastName: `Nom${i}`,
        address1: `${i} rue de la Production`,
        postalCode: "75000",
        city: "Paris",
        country: "FR",
      },
    });
  }

  // --- Intérêts (recensement) — rattachés à un customer (find-or-create) ---
  for (let i = 0; i < 20; i++) {
    const customer = customers[i % customers.length]!;
    const isStylo = i % 2 === 0;
    // Stylo : la couleur tourne selon l'intérêt ; gourde : variante par défaut.
    const variant = isStylo ? styloVariants[(i / 2) % styloVariants.length]! : gourdeVariant;
    await prisma.campaignInterest.create({
      data: {
        campaignId: isStylo ? campaign1.id : campaign2.id,
        customerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        consentToContact: true,
        items: { create: [{ variantId: variant.id, quantity: (i % 5) + 1 }] },
      },
    });
  }

  // --- Commandes ---
  const orders = [];
  for (let i = 1; i <= 10; i++) {
    const customer = customers[i % customers.length]!;
    const quantity = (i % 3) + 1;
    const variant = styloVariants[i % styloVariants.length]!;
    const unitPrice = stylo.price;
    const subtotal = unitPrice.toNumber() * quantity;
    const taxAmount = subtotal * 0.2;
    const total = subtotal + taxAmount;

    const order = await prisma.order.create({
      data: {
        number: `2026-${String(i).padStart(4, "0")}`,
        customerId: customer.id,
        status: i <= 7 ? "PAID" : "PENDING_PAYMENT",
        paymentStatus: i <= 7 ? "PAID" : "UNPAID",
        fulfillmentStatus: "UNFULFILLED",
        currency: "EUR",
        subtotal,
        shippingAmount: 3,
        taxAmount,
        total: total + 3,
        billingAddress: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          address1: "1 rue de la Production",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
        shippingAddress: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          address1: "1 rue de la Production",
          postalCode: "75000",
          city: "Paris",
          country: "FR",
        },
        items: {
          create: [
            {
              variantId: variant.id,
              quantity,
              unitPrice,
              taxRate: 20,
              total: subtotal,
            },
          ],
        },
        payments:
          i <= 7
            ? {
                create: [
                  {
                    provider: "MANUAL",
                    amount: total + 3,
                    currency: "EUR",
                    status: "PAID",
                    paidAt: new Date(),
                  },
                ],
              }
            : undefined,
      },
    });
    orders.push(order);
  }

  // --- Production ---
  const batch = await prisma.productionBatch.upsert({
    where: { reference: "2026-001" },
    update: {},
    create: {
      reference: "2026-001",
      status: "COMPLETED",
      startedAt: new Date("2026-01-15"),
      completedAt: new Date("2026-01-20"),
      items: {
        // 100 stylos au total, répartis par couleur (40 / 30 / 30).
        create: styloVariants.map((variant, index) => ({
          variantId: variant.id,
          quantityPlanned: PRODUCED_PER_COLOR[index]!,
          quantityProduced: PRODUCED_PER_COLOR[index]!,
        })),
      },
    },
  });

  // --- Stock : un mouvement PRODUCTION par variante produite ---
  for (const [index, variant] of styloVariants.entries()) {
    const existingMovement = await prisma.inventoryMovement.findFirst({
      where: {
        variantId: variant.id,
        referenceType: InventoryReferenceType.PRODUCTION_BATCH,
        referenceId: batch.id,
      },
    });

    if (!existingMovement) {
      await prisma.inventoryMovement.create({
        data: {
          variantId: variant.id,
          quantity: PRODUCED_PER_COLOR[index]!,
          type: InventoryMovementType.PRODUCTION,
          referenceType: InventoryReferenceType.PRODUCTION_BATCH,
          referenceId: batch.id,
          reason: "Seed de développement",
        },
      });
    }
  }

  // --- Expéditions (5) ---
  for (let i = 0; i < 5; i++) {
    const order = orders[i]!;
    const existingShipment = await prisma.shipment.findUnique({ where: { orderId: order.id } });
    if (!existingShipment) {
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrier: "Colissimo",
          trackingNumber: `TRACK-${1000 + i}`,
          trackingUrl: `https://tracking.example.com/TRACK-${1000 + i}`,
          status: "SHIPPED",
          shippedAt: new Date(),
          events: {
            create: [
              {
                status: "SHIPPED",
                message: "Colis remis au transporteur",
              },
            ],
          },
        },
      });
    }
  }

  console.log("Seed terminé:", {
    admins: 1,
    operators: operators.length,
    products: 3,
    colors: colors.length,
    variants: styloVariants.length + 2,
    campaigns: 2,
    customers: customers.length,
    orders: orders.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
