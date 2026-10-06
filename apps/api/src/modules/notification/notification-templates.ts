import { prisma } from "@preorderflow/database";
import { escapeHtml, wrapEmail } from "./email-layout";

export interface RenderedEmail {
  subject: string;
  html: string;
}

export type TemplatePayloads = {
  // `details` = répartition par couleur, déjà mise en forme (« (2 × Rouge, 1 × Bleu) »),
  // vide quand le produit n'a pas de couleur.
  INTEREST_REGISTERED: {
    firstName: string;
    campaignName: string;
    quantity: number;
    details?: string;
  };
  // Mail aux personnes intéressées quand les commandes s'ouvrent. `quantity` et `details` reprennent
  // ce qu'elles avaient demandé au recensement (même format que INTEREST_REGISTERED).
  ORDERS_OPENED: {
    firstName: string;
    campaignName: string;
    campaignUrl: string;
    quantity: number;
    details?: string;
  };
  // `items` = tableau HTML des produits commandés (cf. email-layout.ts), injecté tel quel.
  ORDER_CREATED: { firstName: string; orderNumber: string; total: string; items?: string };
  PAYMENT_RECEIVED: { firstName: string; orderNumber: string; amount: string; items?: string };
  ORDER_READY: { firstName: string; orderNumber: string; items?: string };
  ORDER_SHIPPED: { firstName: string; orderNumber: string; trackingUrl?: string; items?: string };
  ORDER_DELIVERED: { firstName: string; orderNumber: string; items?: string };
  CUSTOMER_MAGIC_LINK: { firstName: string; magicLinkUrl: string; expiresInMinutes: number };
};

// Templates par défaut, en `{{placeholder}}` plutôt qu'en template literals
// JS — même format que les surcharges éditables depuis /settings (aucune
// distinction de traitement entre "défaut" et "personnalisé"). À enrichir
// plus tard avec une vraie mise en forme, sans changer TemplatePayloads.
// NB: ADMIN_ALERT (alerte push ntfy) n'a pas de rendu email et n'est donc
// pas ici — cf. NotificationService.notifyAdmin().
export const DEFAULT_TEMPLATES: Record<keyof TemplatePayloads, RenderedEmail> = {
  INTEREST_REGISTERED: {
    subject: "Merci pour votre intérêt — {{campaignName}}",
    html: '<p>Bonjour {{firstName}},</p><p>Nous avons bien reçu votre demande pour {{quantity}} exemplaire(s){{details}} de "{{campaignName}}". Ceci ne constitue pas une commande.</p>',
  },
  ORDERS_OPENED: {
    subject: "Les commandes sont ouvertes — {{campaignName}}",
    html: '<p>Bonjour {{firstName}},</p><p>Bonne nouvelle : les commandes de "{{campaignName}}" sont ouvertes. Vous aviez demandé {{quantity}} exemplaire(s){{details}}.</p><p>Pour valider votre commande et la payer, rendez-vous ici : <a href="{{campaignUrl}}">{{campaignUrl}}</a></p>',
  },
  ORDER_CREATED: {
    subject: "Commande {{orderNumber}} confirmée",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} d'un montant de {{total}} € a bien été enregistrée.</p><p><strong>Récapitulatif de votre commande</strong></p>{{items}}",
  },
  PAYMENT_RECEIVED: {
    subject: "Paiement reçu — commande {{orderNumber}}",
    html: "<p>Bonjour {{firstName}},</p><p>Nous avons bien reçu votre paiement de {{amount}} € pour la commande {{orderNumber}}.</p>{{items}}",
  },
  ORDER_READY: {
    subject: "Commande {{orderNumber}} prête",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} est prête à être expédiée.</p>{{items}}",
  },
  ORDER_SHIPPED: {
    subject: "Commande {{orderNumber}} expédiée",
    html: '<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} a été expédiée. Suivi : <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>{{items}}',
  },
  ORDER_DELIVERED: {
    subject: "Commande {{orderNumber}} livrée",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} a été livrée. Merci pour votre confiance !</p>{{items}}",
  },
  CUSTOMER_MAGIC_LINK: {
    subject: "Votre lien de connexion PreOrderFlow",
    html: "<p>Bonjour {{firstName}},</p><p>Cliquez sur ce lien pour accéder à votre espace client (valable {{expiresInMinutes}} minutes) : <a href=\"{{magicLinkUrl}}\">{{magicLinkUrl}}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>",
  },
};

// Placeholders dont la valeur est déjà du HTML maîtrisé par l'API ; tous les autres
// (prénom, URL…) sont échappés pour ne pas injecter de balises dans le mail.
const RAW_HTML_KEYS = new Set(["items"]);

export function substitute(
  text: string,
  payload: Record<string, unknown>,
  { escape = true }: { escape?: boolean } = {},
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = payload[key];
    if (value === undefined || value === null) return "";
    return escape && !RAW_HTML_KEYS.has(key) ? escapeHtml(String(value)) : String(value);
  });
}

export async function renderTemplate<T extends keyof TemplatePayloads>(
  template: T,
  payload: TemplatePayloads[T],
): Promise<RenderedEmail> {
  const override = await prisma.notificationTemplateOverride.findUnique({ where: { template } });
  const source = override ?? DEFAULT_TEMPLATES[template];
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return {
    // Le sujet est du texte brut : pas d'échappement HTML.
    subject: substitute(source.subject, payload, { escape: false }),
    html: wrapEmail(substitute(source.html, payload), settings?.businessName ?? null),
  };
}
