import { z } from "zod";

// Schémas partagés front/back — validés à nouveau côté NestJS (DTO), jamais
// une source de vérité unique (cf. CLAUDE.md §26 : validation Zod front +
// validation DTO back).

export const createInterestSchema = z.object({
  campaignId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  quantity: z.number().int().min(1).max(999),
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
