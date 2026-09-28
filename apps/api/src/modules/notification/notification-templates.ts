import { prisma } from "@preorderflow/database";

export interface RenderedEmail {
  subject: string;
  html: string;
}

export type TemplatePayloads = {
  INTEREST_REGISTERED: { firstName: string; campaignName: string; quantity: number };
  ORDERS_OPENED: { campaignName: string; campaignUrl: string };
  ORDER_CREATED: { firstName: string; orderNumber: string; total: string };
  PAYMENT_RECEIVED: { firstName: string; orderNumber: string; amount: string };
  ORDER_READY: { firstName: string; orderNumber: string };
  ORDER_SHIPPED: { firstName: string; orderNumber: string; trackingUrl?: string };
  ORDER_DELIVERED: { firstName: string; orderNumber: string };
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
    html: '<p>Bonjour {{firstName}},</p><p>Nous avons bien reçu votre demande pour {{quantity}} exemplaire(s) de "{{campaignName}}". Ceci ne constitue pas une commande.</p>',
  },
  ORDERS_OPENED: {
    subject: "Les commandes sont ouvertes — {{campaignName}}",
    html: '<p>Bonne nouvelle, vous pouvez maintenant commander "{{campaignName}}" : <a href="{{campaignUrl}}">{{campaignUrl}}</a></p>',
  },
  ORDER_CREATED: {
    subject: "Commande {{orderNumber}} confirmée",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} d'un montant de {{total}} € a bien été enregistrée.</p>",
  },
  PAYMENT_RECEIVED: {
    subject: "Paiement reçu — commande {{orderNumber}}",
    html: "<p>Bonjour {{firstName}},</p><p>Nous avons bien reçu votre paiement de {{amount}} € pour la commande {{orderNumber}}.</p>",
  },
  ORDER_READY: {
    subject: "Commande {{orderNumber}} prête",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} est prête à être expédiée.</p>",
  },
  ORDER_SHIPPED: {
    subject: "Commande {{orderNumber}} expédiée",
    html: '<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} a été expédiée. Suivi : <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>',
  },
  ORDER_DELIVERED: {
    subject: "Commande {{orderNumber}} livrée",
    html: "<p>Bonjour {{firstName}},</p><p>Votre commande {{orderNumber}} a été livrée. Merci pour votre confiance !</p>",
  },
  CUSTOMER_MAGIC_LINK: {
    subject: "Votre lien de connexion PreOrderFlow",
    html: "<p>Bonjour {{firstName}},</p><p>Cliquez sur ce lien pour accéder à votre espace client (valable {{expiresInMinutes}} minutes) : <a href=\"{{magicLinkUrl}}\">{{magicLinkUrl}}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>",
  },
};

export function substitute(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function renderTemplate<T extends keyof TemplatePayloads>(
  template: T,
  payload: TemplatePayloads[T],
): Promise<RenderedEmail> {
  const override = await prisma.notificationTemplateOverride.findUnique({ where: { template } });
  const source = override ?? DEFAULT_TEMPLATES[template];
  return {
    subject: substitute(source.subject, payload),
    html: substitute(source.html, payload),
  };
}
