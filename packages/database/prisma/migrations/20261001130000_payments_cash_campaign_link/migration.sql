-- Mode de paiement « espèces ».
ALTER TYPE "PaymentProvider" ADD VALUE 'CASH';

-- Lien de paiement propre à une campagne.
ALTER TABLE "campaigns" ADD COLUMN "paymentLink" TEXT;

-- Campagne d'origine d'une commande (facultative).
ALTER TABLE "orders" ADD COLUMN "campaignId" TEXT;
CREATE INDEX "orders_campaignId_idx" ON "orders"("campaignId");
ALTER TABLE "orders" ADD CONSTRAINT "orders_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
