-- Catalogue de transporteurs : La Poste (lettres + Colissimo) et Mondial Relay (point relais + domicile).
ALTER TYPE "Carrier" RENAME VALUE 'MONDIAL_RELAY' TO 'MONDIAL_RELAY_POINT';
ALTER TYPE "Carrier" ADD VALUE 'MONDIAL_RELAY_DOMICILE';
ALTER TYPE "Carrier" ADD VALUE 'COLISSIMO_RETRAIT';
ALTER TYPE "Carrier" ADD VALUE 'COLISSIMO_DOMICILE';

-- Les tarifs viennent désormais du barème par poids du code : plus de forfait ni de seuil de quantité.
ALTER TABLE "app_settings" DROP COLUMN "mondialRelayRate";
ALTER TABLE "app_settings" DROP COLUMN "laPosteMaxQuantity";
