-- Mode de remise d'une commande : livraison ou remise en main propre.
CREATE TYPE "DeliveryMethod" AS ENUM ('SHIPPING', 'PICKUP');
ALTER TABLE "orders" ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'SHIPPING';
