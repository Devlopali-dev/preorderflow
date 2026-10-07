-- Mode « livraison » par campagne : désactivé, seule la remise en main propre est proposée.
ALTER TABLE "campaigns" ADD COLUMN "shippingEnabled" BOOLEAN NOT NULL DEFAULT true;
