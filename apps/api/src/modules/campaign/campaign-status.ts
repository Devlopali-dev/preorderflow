import { CampaignStatus } from "@preorderflow/database";

// Machine à états — cf. docs/architecture.md §4.1. Aucune transition en
// dehors de cette table n'est autorisée (pas de retour arrière, pas de saut).
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["RECENSEMENT", "ANNULEE"],
  RECENSEMENT: ["COMMANDES_OUVERTES", "ANNULEE"],
  COMMANDES_OUVERTES: ["COMMANDES_FERMEES", "ANNULEE"],
  COMMANDES_FERMEES: ["PRODUCTION"],
  PRODUCTION: ["EXPEDITION"],
  EXPEDITION: ["TERMINEE"],
  TERMINEE: [],
  ANNULEE: [],
};

export class InvalidCampaignTransitionError extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Transition de campagne invalide: ${from} -> ${to}`);
    this.name = "InvalidCampaignTransitionError";
  }
}

export function assertValidCampaignTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (from === to) {
    return;
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidCampaignTransitionError(from, to);
  }
}
