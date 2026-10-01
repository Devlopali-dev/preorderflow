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

// Commande passée depuis la page publique d'une campagne dont les commandes sont ouvertes.
// Les lignes (couleurs et quantités) vivent dans l'état du formulaire, comme pour le recensement.
export const createPublicOrderSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  phone: z.string().max(30).optional(),
  address1: z.string().min(1, "Adresse requise").max(200),
  address2: z.string().max(200).optional(),
  postalCode: z.string().min(1, "Code postal requis").max(20),
  city: z.string().min(1, "Ville requise").max(100),
  country: z.string().length(2, "Code pays à 2 lettres (ex : FR)"),
  notes: z.string().max(1000).optional(),
  // champ honeypot anti-spam : doit rester vide
  website: z.string().max(0).optional(),
});

export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
