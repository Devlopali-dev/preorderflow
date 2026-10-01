-- Le prix n'est plus porté par la campagne : Product.price reste la source unique.
-- Perte assumée des prix indicatifs de campagne existants (les lignes de commande gardent leur unitPrice).
ALTER TABLE "campaigns" DROP COLUMN "indicativePrice";
