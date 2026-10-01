import { CampaignStatus } from "@preorderflow/database";

// Passage automatique des campagnes selon leurs dates (cf. docs/architecture.md §4.1) :
// - à partir de la date de début, une campagne en brouillon ou en recensement passe en
//   « commandes ouvertes » ;
// - après la date de fin, une campagne en brouillon, en recensement ou aux commandes
//   ouvertes passe en « commandes fermées » (la fermeture l'emporte sur l'ouverture).
// Les statuts plus avancés (production, expédition) et les archives ne sont jamais touchés.
// Chaque cible reste atteignable par la machine à états (campaign-status.ts), en
// enchaînant les étapes intermédiaires.

const FROM_BEFORE_OPENING: CampaignStatus[] = ["DRAFT", "RECENSEMENT"];
const FROM_BEFORE_CLOSING: CampaignStatus[] = ["DRAFT", "RECENSEMENT", "COMMANDES_OUVERTES"];

export const SCHEDULED_STATUSES = FROM_BEFORE_CLOSING;

const DAY_MS = 24 * 60 * 60 * 1000;

// L'interface n'envoie qu'une date (« 2026-12-15 »), enregistrée à minuit UTC : la date de
// fin est alors inclusive, la campagne se ferme à la fin de ce jour-là et non à son début.
// Une date de fin avec une heure précise est respectée telle quelle.
export function closingInstant(endDate: Date): Date {
  const isDateOnly =
    endDate.getUTCHours() === 0 &&
    endDate.getUTCMinutes() === 0 &&
    endDate.getUTCSeconds() === 0 &&
    endDate.getUTCMilliseconds() === 0;
  return isDateOnly ? new Date(endDate.getTime() + DAY_MS) : endDate;
}

export function automaticTargetStatus(
  campaign: { status: CampaignStatus; startDate: Date | null; endDate: Date | null },
  now: Date,
): CampaignStatus | null {
  const { status, startDate, endDate } = campaign;

  if (endDate && FROM_BEFORE_CLOSING.includes(status) && now > closingInstant(endDate)) {
    return "COMMANDES_FERMEES";
  }
  if (startDate && FROM_BEFORE_OPENING.includes(status) && now >= startDate) {
    return "COMMANDES_OUVERTES";
  }
  return null;
}
