-- Tarifs La Poste synchronisés depuis l'API data.laposte.fr, stockés avec leur date de synchronisation.
ALTER TABLE "app_settings" ADD COLUMN "carrierTariffs" JSONB;
ALTER TABLE "app_settings" ADD COLUMN "carrierTariffsSyncedAt" TIMESTAMP(3);
