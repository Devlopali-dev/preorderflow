-- Frais de livraison paramétrables : forfait + seuil de gratuité (sous-total HT).
ALTER TABLE "app_settings" ADD COLUMN "shippingFlatRate" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN "freeShippingThreshold" DECIMAL(10,2);
