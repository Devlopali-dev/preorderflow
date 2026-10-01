-- Journal d'audit : suppression définitive et réactivation d'une campagne.
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_REACTIVATED';
