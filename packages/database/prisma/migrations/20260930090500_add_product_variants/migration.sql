-- Variantes de produit (couleurs). Migration avec rattrapage des données :
-- chaque produit existant reçoit une variante par défaut (colorId = NULL,
-- sku repris du produit), puis stock / production / commandes / intérêts
-- passent de productId à variantId sans perte.

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorId" TEXT,
    "sku" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_interest_items" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "campaign_interest_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_colorId_key" ON "product_variants"("productId", "colorId");

-- CreateIndex
CREATE INDEX "campaign_interest_items_variantId_idx" ON "campaign_interest_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_interest_items_interestId_variantId_key" ON "campaign_interest_items"("interestId", "variantId");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_interest_items" ADD CONSTRAINT "campaign_interest_items_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "campaign_interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_interest_items" ADD CONSTRAINT "campaign_interest_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill : une variante par défaut par produit existant
INSERT INTO "product_variants" ("id", "productId", "colorId", "sku", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", NULL, p."sku", p."active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "products" p;

-- order_items : productId -> variantId
ALTER TABLE "order_items" ADD COLUMN "variantId" TEXT;
UPDATE "order_items" t SET "variantId" = v."id"
FROM "product_variants" v WHERE v."productId" = t."productId" AND v."colorId" IS NULL;
ALTER TABLE "order_items" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "order_items" DROP COLUMN "productId";
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- production_items : productId -> variantId
ALTER TABLE "production_items" ADD COLUMN "variantId" TEXT;
UPDATE "production_items" t SET "variantId" = v."id"
FROM "product_variants" v WHERE v."productId" = t."productId" AND v."colorId" IS NULL;
ALTER TABLE "production_items" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "production_items" DROP COLUMN "productId";
CREATE INDEX "production_items_variantId_idx" ON "production_items"("variantId");
ALTER TABLE "production_items" ADD CONSTRAINT "production_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- inventory_movements : productId -> variantId
ALTER TABLE "inventory_movements" ADD COLUMN "variantId" TEXT;
UPDATE "inventory_movements" t SET "variantId" = v."id"
FROM "product_variants" v WHERE v."productId" = t."productId" AND v."colorId" IS NULL;
ALTER TABLE "inventory_movements" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "inventory_movements" DROP COLUMN "productId";
CREATE INDEX "inventory_movements_variantId_idx" ON "inventory_movements"("variantId");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- campaign_interests : quantity -> une ligne campaign_interest_items par intérêt
INSERT INTO "campaign_interest_items" ("id", "interestId", "variantId", "quantity")
SELECT gen_random_uuid()::text, i."id", v."id", i."quantity"
FROM "campaign_interests" i
JOIN "campaigns" c ON c."id" = i."campaignId"
JOIN "product_variants" v ON v."productId" = c."productId" AND v."colorId" IS NULL;
ALTER TABLE "campaign_interests" DROP COLUMN "quantity";
