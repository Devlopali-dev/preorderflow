-- Statut de campagne forcé à la main : prime sur le passage automatique selon les dates.
ALTER TABLE "campaigns" ADD COLUMN "scheduleOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_STATUS_CHANGED';
