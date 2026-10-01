// Une campagne archivée (terminée ou annulée) est en lecture seule : on ne peut
// que la réactiver (retour en brouillon) ou la supprimer définitivement. Reflète
// isArchivedStatus côté API (campaign-status.ts), qui reste l'autorité.
export const ARCHIVED_CAMPAIGN_STATUSES = ["TERMINEE", "ANNULEE"];

export function isArchivedCampaign(status: string): boolean {
  return ARCHIVED_CAMPAIGN_STATUSES.includes(status);
}
