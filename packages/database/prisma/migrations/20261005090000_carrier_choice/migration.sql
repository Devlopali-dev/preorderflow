-- Choix du transporteur selon la quantité : La Poste (enveloppe) ou Mondial Relay.
CREATE TYPE "Carrier" AS ENUM ('LA_POSTE', 'MONDIAL_RELAY');

ALTER TABLE "orders" ADD COLUMN "carrier" "Carrier";

ALTER TABLE "app_settings" ADD COLUMN "laPosteRate" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN "mondialRelayRate" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN "laPosteMaxQuantity" INTEGER NOT NULL DEFAULT 4;

-- Reprise du forfait actuel comme tarif de départ des deux transporteurs.
UPDATE "app_settings" SET "laPosteRate" = "shippingFlatRate", "mondialRelayRate" = "shippingFlatRate";
