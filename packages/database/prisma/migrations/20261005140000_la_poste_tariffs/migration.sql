-- La Poste : deux services (Lettre Verte Suivie / Lettre Verte), tarif selon le poids de l'envoi.
ALTER TYPE "Carrier" RENAME VALUE 'LA_POSTE' TO 'LA_POSTE_SUIVIE';
ALTER TYPE "Carrier" ADD VALUE 'LA_POSTE_VERTE';

-- Le barème La Poste vit dans le code (tarifs publics annuels) ; on ne garde que le poids d'emballage.
ALTER TABLE "app_settings" DROP COLUMN "laPosteRate";
ALTER TABLE "app_settings" ADD COLUMN "packagingWeightGrams" INTEGER NOT NULL DEFAULT 10;
