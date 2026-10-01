-- Photos d'un produit : jusqu'à 3, ordonnées (la première est la principale).
CREATE TABLE "product_photos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_photos_productId_position_idx" ON "product_photos"("productId", "position");

ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise de la photo unique existante comme photo principale.
INSERT INTO "product_photos" ("id", "productId", "url", "position")
SELECT gen_random_uuid()::text, "id", "imageUrl", 0 FROM "products" WHERE "imageUrl" IS NOT NULL;

ALTER TABLE "products" DROP COLUMN "imageUrl";
