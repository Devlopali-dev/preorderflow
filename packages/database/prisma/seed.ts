import {
  PrismaClient,
  InventoryMovementType,
  InventoryReferenceType,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
  type ShipmentStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Jeu de démonstration (cahier des charges §30), rejouable : chaque bloc ne crée
// que ce qui manque. Il couvre aussi chaque écran de l'application : archives de
// campagnes, produit archivé, couleur inactive, commandes à tous les stades,
// expéditions à tous les stades, lots de production à plusieurs statuts.

// Répartition des 100 stylos produits par couleur (Rouge, Bleu, Noir).
const PRODUCED_PER_COLOR = [40, 30, 30];

// Une commande par ligne : statut de commande, de paiement et de préparation
// cohérents entre eux (les 5 premières sont expédiées, cf. SHIPMENT_PLAN).
const ORDER_PLAN: Array<{
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
}> = [
  { status: "DELIVERED", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED" },
  { status: "DELIVERED", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED" },
  { status: "SHIPPED", paymentStatus: "PAID", fulfillmentStatus: "SHIPPED" },
  { status: "SHIPPED", paymentStatus: "PAID", fulfillmentStatus: "SHIPPED" },
  { status: "SHIPPED", paymentStatus: "PAID", fulfillmentStatus: "SHIPPED" },
  { status: "READY_TO_SHIP", paymentStatus: "PAID", fulfillmentStatus: "READY_TO_SHIP" },
  { status: "PROCESSING", paymentStatus: "PAID", fulfillmentStatus: "PROCESSING" },
  { status: "PAID", paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED" },
  { status: "PENDING_PAYMENT", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" },
  { status: "CANCELLED", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" },
];

// Une expédition par ligne, pour les 5 premières commandes.
const SHIPMENT_CHAIN: ShipmentStatus[] = [
  "PENDING",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
const SHIPMENT_PLAN: ShipmentStatus[] = [
  "DELIVERED",
  "DELIVERED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
];
const SHIPMENT_MESSAGE: Partial<Record<ShipmentStatus, string>> = {
  PENDING: "Expédition créée",
  SHIPPED: "Colis remis au transporteur",
  IN_TRANSIT: "Colis en transit",
  OUT_FOR_DELIVERY: "Colis en cours de livraison",
  DELIVERED: "Colis livré",
};

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

  // --- Identité de l'atelier (paramètres) : jamais écrasée si déjà renseignée ---
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName: "Atelier PreOrderFlow",
      contactEmail: "contact@preorderflow.dev",
    },
  });

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

  const tote = await prisma.product.upsert({
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

  // Produit archivé : alimente la section « Archivés » de la page produits et
  // le marquage « archivé » à la création d'une campagne.
  const carnet = await prisma.product.upsert({
    where: { sku: "CARNET-001" },
    update: {},
    create: {
      sku: "CARNET-001",
      name: "Carnet A5",
      slug: "carnet-a5",
      description: "Carnet A5 papier recyclé, série terminée.",
      price: 4,
      currency: "EUR",
      taxRate: 20,
      weight: 0.15,
      active: false,
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

  // Couleur inactive (et inutilisée) : montre l'italique et le badge d'avertissement.
  await prisma.color.upsert({
    where: { name: "Vert" },
    update: {},
    create: { name: "Vert", hex: "#2a9d3f", active: false },
  });

  // Stylo : une variante par couleur. Gourde, tote et carnet : variante Standard
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
    create: { productId: tote.id, sku: "TOTE-001" },
  });
  const carnetVariant = await prisma.productVariant.upsert({
    where: { sku: "CARNET-001" },
    update: {},
    create: { productId: carnet.id, sku: "CARNET-001" },
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
      endDate: new Date("2026-04-15"),
      productId: gourde.id,
    },
  });

  // Une campagne brouillon, pour l'action « Passer à RECENSEMENT ».
  await prisma.campaign.upsert({
    where: { slug: "tote-bag-1" },
    update: {},
    create: {
      name: "Tote bag #1",
      slug: "tote-bag-1",
      description: "Campagne en préparation pour le tote bag.",
      status: "DRAFT",
      startDate: new Date("2026-05-01"),
      productId: tote.id,
    },
  });

  // Archives : une campagne terminée et une annulée, avec leurs demandes de
  // recensement (réactivation, suppression définitive).
  const archivedDone = await prisma.campaign.upsert({
    where: { slug: "carnet-0" },
    update: {},
    create: {
      name: "Carnet #0",
      slug: "carnet-0",
      description: "Campagne terminée : le carnet A5, série épuisée.",
      status: "TERMINEE",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-11-30"),
      productId: carnet.id,
    },
  });
  const archivedCancelled = await prisma.campaign.upsert({
    where: { slug: "gourde-inox-0" },
    update: {},
    create: {
      name: "Gourde inox #0",
      slug: "gourde-inox-0",
      description: "Campagne annulée : fournisseur indisponible.",
      status: "ANNULEE",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2025-12-15"),
      productId: gourde.id,
    },
  });

  // --- Clients (identité complète) et adresses de facturation + livraison ---
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(2, "0");
    const customer = await prisma.customer.upsert({
      where: { email: `client${i}@example.com` },
      update: {},
      create: {
        email: `client${i}@example.com`,
        firstName: `Prenom${i}`,
        lastName: `Nom${i}`,
        phone: `060000${pad}${pad}`,
      },
    });
    customers.push(customer);

    // Rejouable : le carnet d'adresses de démo seulement si le client n'en a aucun.
    if ((await prisma.address.count({ where: { customerId: customer.id } })) === 0) {
      await prisma.address.createMany({
        data: [
          {
            customerId: customer.id,
            type: "BILLING",
            firstName: `Prenom${i}`,
            lastName: `Nom${i}`,
            company: i % 3 === 0 ? `Société ${i}` : null,
            address1: `${i} avenue de la Facturation`,
            address2: i % 2 === 0 ? `Bâtiment ${i}` : null,
            postalCode: "69001",
            city: "Lyon",
            country: "FR",
            phone: `070000${pad}${pad}`,
          },
          {
            customerId: customer.id,
            type: "SHIPPING",
            firstName: `Prenom${i}`,
            lastName: `Nom${i}`,
            address1: `${i} rue de la Production`,
            postalCode: "75000",
            city: "Paris",
            country: "FR",
            phone: `060000${pad}${pad}`,
          },
        ],
      });
    }
  }

  // Adresses de chaque client, pour les instantanés figés sur les commandes.
  const addresses = await prisma.address.findMany({
    where: { customerId: { in: customers.map((c) => c.id) } },
  });
  const snapshotOf = (customerId: string, type: "BILLING" | "SHIPPING") => {
    const address = addresses.find((a) => a.customerId === customerId && a.type === type);
    const fallback = addresses.find((a) => a.customerId === customerId);
    const source = address ?? fallback;
    return {
      firstName: source?.firstName ?? "Prenom",
      lastName: source?.lastName ?? "Nom",
      company: source?.company ?? null,
      address1: source?.address1 ?? "1 rue de la Production",
      address2: source?.address2 ?? null,
      postalCode: source?.postalCode ?? "75000",
      city: source?.city ?? "Paris",
      country: source?.country ?? "FR",
      phone: source?.phone ?? null,
    };
  };

  // --- Intérêts (recensement) — rattachés à un customer (find-or-create) ---
  // Rejouable : seulement si les campagnes de démo n'ont encore aucune demande
  // (le jeu de démo contient volontairement plusieurs demandes d'un même client
  // sur une même campagne, une clé client + campagne ne convient donc pas).
  const hasDemoInterests =
    (await prisma.campaignInterest.count({
      where: { campaignId: { in: [campaign1.id, campaign2.id] } },
    })) > 0;
  for (let i = 0; i < 20 && !hasDemoInterests; i++) {
    const customer = customers[i % customers.length]!;
    const isStylo = i % 2 === 0;
    // Stylo : la couleur tourne selon l'intérêt ; gourde : variante Standard.
    const variantIndex = (i / 2) % styloVariants.length;
    const first = isStylo ? styloVariants[variantIndex]! : gourdeVariant;
    const items = [{ variantId: first.id, quantity: (i % 5) + 1 }];
    // Un intérêt du stylo sur deux demande une seconde couleur : une personne,
    // plusieurs couleurs, un seul consentement.
    if (isStylo && i % 4 === 0) {
      const second = styloVariants[(variantIndex + 1) % styloVariants.length]!;
      items.push({ variantId: second.id, quantity: (i % 3) + 1 });
    }
    await prisma.campaignInterest.create({
      data: {
        campaignId: isStylo ? campaign1.id : campaign2.id,
        customerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: i % 2 === 0 ? customer.phone : null,
        comment: i % 7 === 0 ? "Je souhaite être prévenu(e) dès l'ouverture des commandes." : null,
        consentToContact: true,
        items: { create: items },
      },
    });
  }

  // Demandes des campagnes archivées (rejouable : seulement si elles n'en ont pas).
  const archivedInterests = [
    { campaign: archivedDone, variantId: carnetVariant.id },
    { campaign: archivedCancelled, variantId: gourdeVariant.id },
  ];
  for (const { campaign, variantId } of archivedInterests) {
    if ((await prisma.campaignInterest.count({ where: { campaignId: campaign.id } })) > 0) continue;
    for (const [index, customer] of customers.slice(0, 3).entries()) {
      await prisma.campaignInterest.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          consentToContact: true,
          items: { create: [{ variantId, quantity: index + 1 }] },
        },
      });
    }
  }

  // --- Commandes (10, à tous les stades) ---
  const orders = [];
  for (let i = 1; i <= 10; i++) {
    // Rejouable : une commande de démo déjà créée est reprise telle quelle.
    const number = `2026-${String(i).padStart(4, "0")}`;
    const existingOrder = await prisma.order.findUnique({ where: { number } });
    if (existingOrder) {
      orders.push(existingOrder);
      continue;
    }

    const plan = ORDER_PLAN[i - 1]!;
    const customer = customers[i % customers.length]!;
    const quantity = (i % 3) + 1;
    const variant = styloVariants[i % styloVariants.length]!;
    const unitPrice = stylo.price;
    const subtotal = unitPrice.toNumber() * quantity;
    const taxAmount = subtotal * 0.2;
    const total = subtotal + taxAmount;
    const paid = plan.paymentStatus === "PAID";

    const order = await prisma.order.create({
      data: {
        number,
        customerId: customer.id,
        status: plan.status,
        paymentStatus: plan.paymentStatus,
        fulfillmentStatus: plan.fulfillmentStatus,
        currency: "EUR",
        subtotal,
        shippingAmount: 3,
        taxAmount,
        total: total + 3,
        billingAddress: snapshotOf(customer.id, "BILLING"),
        shippingAddress: snapshotOf(customer.id, "SHIPPING"),
        notes: i === 6 ? "Cadeau : emballage soigné, merci." : null,
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
        // Payée : paiement manuel confirmé. En attente ou annulée : virement
        // jamais reçu (la commande annulée garde son paiement en lecture seule).
        payments: {
          create: [
            paid
              ? {
                  provider: "MANUAL",
                  amount: total + 3,
                  currency: "EUR",
                  status: "PAID",
                  paidAt: new Date(),
                }
              : {
                  provider: "BANK_TRANSFER",
                  amount: total + 3,
                  currency: "EUR",
                  status: "PENDING",
                },
          ],
        },
      },
    });
    orders.push(order);
  }

  // --- Production : un lot terminé, un planifié, un en cours ---
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

  // Planifié : action « Démarrer ». Rien de produit, donc aucun mouvement de stock.
  await prisma.productionBatch.upsert({
    where: { reference: "stylo-20260901" },
    update: {},
    create: {
      reference: "stylo-20260901",
      status: "PLANNED",
      notes: "Deuxième série de stylos, à lancer après les premières livraisons.",
      items: {
        create: [{ variantId: styloVariants[0]!.id, quantityPlanned: 50, quantityProduced: 0 }],
      },
    },
  });

  // En cours, rien déclaré produit : actions +1 / +10. Le stock reste à 100 stylos (§30).
  await prisma.productionBatch.upsert({
    where: { reference: "gourde-inox-500-20260915" },
    update: {},
    create: {
      reference: "gourde-inox-500-20260915",
      status: "IN_PROGRESS",
      startedAt: new Date("2026-09-15"),
      items: {
        create: [{ variantId: gourdeVariant.id, quantityPlanned: 40, quantityProduced: 0 }],
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

  // --- Expéditions (5), de la plus avancée à la plus récente ---
  for (let i = 0; i < SHIPMENT_PLAN.length; i++) {
    const order = orders[i]!;
    const target = SHIPMENT_PLAN[i]!;
    const existingShipment = await prisma.shipment.findUnique({ where: { orderId: order.id } });
    if (existingShipment) continue;

    // Historique de transport : toutes les étapes jusqu'au statut courant.
    const steps = SHIPMENT_CHAIN.slice(0, SHIPMENT_CHAIN.indexOf(target) + 1);
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: "Colissimo",
        trackingNumber: `TRACK-${1000 + i}`,
        trackingUrl: `https://tracking.example.com/TRACK-${1000 + i}`,
        status: target,
        shippedAt: new Date(),
        deliveredAt: target === "DELIVERED" ? new Date() : null,
        weight: 0.05,
        events: {
          create: steps.map((status) => ({ status, message: SHIPMENT_MESSAGE[status] })),
        },
      },
    });
  }

  console.log("Seed terminé:", {
    admins: 1,
    operators: operators.length,
    products: 4,
    colors: colors.length + 1,
    variants: styloVariants.length + 3,
    campaigns: 5,
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
