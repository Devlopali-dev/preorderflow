import { z } from "zod";

// Schémas partagés front/back — validés à nouveau côté NestJS (DTO), jamais
// une source de vérité unique (cf. CLAUDE.md §26 : validation Zod front +
// validation DTO back).

// Une ligne par couleur demandée : « 2 rouges + 1 bleu » = 2 items. La
// quantité totale d'une personne est dérivée (somme), jamais stockée.
export const interestItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

export type InterestItemInput = z.infer<typeof interestItemSchema>;

export const createInterestSchema = z.object({
  campaignId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  items: z.array(interestItemSchema).min(1),
  comment: z.string().max(1000).optional(),
  consentToContact: z.boolean(),
  // champ honeypot anti-spam : doit rester vide
  website: z.string().max(0).optional(),
});

export type CreateInterestInput = z.infer<typeof createInterestSchema>;

export const campaignStatusSchema = z.enum([
  "DRAFT",
  "RECENSEMENT",
  "COMMANDES_OUVERTES",
  "COMMANDES_FERMEES",
  "PRODUCTION",
  "EXPEDITION",
  "TERMINEE",
  "ANNULEE",
]);

export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
