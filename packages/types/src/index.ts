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
export const deliveryMethodSchema = z.enum(["SHIPPING", "PICKUP"]);

export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

export const createPublicOrderSchema = z
  .object({
    email: z.string().email("Adresse e-mail invalide"),
    firstName: z.string().min(1, "Prénom requis").max(100),
    lastName: z.string().min(1, "Nom requis").max(100),
    phone: z.string().max(30).optional(),
    deliveryMethod: deliveryMethodSchema,
    // Adresse : obligatoire seulement pour une livraison (cf. superRefine).
    address1: z.string().max(200).optional(),
    address2: z.string().max(200).optional(),
    postalCode: z.string().max(20).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(2).optional(),
    notes: z.string().max(1000).optional(),
    // champ honeypot anti-spam : doit rester vide
    website: z.string().max(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod !== "SHIPPING") return;
    const required: Array<[keyof typeof value, string]> = [
      ["address1", "Adresse requise"],
      ["postalCode", "Code postal requis"],
      ["city", "Ville requise"],
    ];
    for (const [field, message] of required) {
      if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message });
    }
    if (value.country?.length !== 2) {
      ctx.addIssue({
        code: "custom",
        path: ["country"],
        message: "Code pays à 2 lettres (ex : FR)",
      });
    }
  });

export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
