-- Marqueur d'envoi du mail d'ouverture des commandes aux personnes intéressées.
ALTER TABLE "campaigns" ADD COLUMN "ordersOpenedMailedAt" TIMESTAMP(3);
