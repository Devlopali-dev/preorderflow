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
};

// Templates HTML minimaux, sans dépendance externe (§32 : pas de
// dépendance obligatoire au cœur de l'application). À enrichir plus tard
// avec une vraie mise en forme, sans changer la signature.
// NB: ADMIN_ALERT (alerte push ntfy) n'a pas de rendu email et n'est donc
// pas dans TemplatePayloads — cf. NotificationService.notifyAdmin().
export function renderTemplate<T extends keyof TemplatePayloads>(
  template: T,
  payload: TemplatePayloads[T],
): RenderedEmail {
  switch (template) {
    case "INTEREST_REGISTERED": {
      const p = payload as TemplatePayloads["INTEREST_REGISTERED"];
      return {
        subject: `Merci pour votre intérêt — ${p.campaignName}`,
        html: `<p>Bonjour ${p.firstName},</p><p>Nous avons bien reçu votre demande pour ${p.quantity} exemplaire(s) de "${p.campaignName}". Ceci ne constitue pas une commande.</p>`,
      };
    }
    case "ORDERS_OPENED": {
      const p = payload as TemplatePayloads["ORDERS_OPENED"];
      return {
        subject: `Les commandes sont ouvertes — ${p.campaignName}`,
        html: `<p>Bonne nouvelle, vous pouvez maintenant commander "${p.campaignName}" : <a href="${p.campaignUrl}">${p.campaignUrl}</a></p>`,
      };
    }
    case "ORDER_CREATED": {
      const p = payload as TemplatePayloads["ORDER_CREATED"];
      return {
        subject: `Commande ${p.orderNumber} confirmée`,
        html: `<p>Bonjour ${p.firstName},</p><p>Votre commande ${p.orderNumber} d'un montant de ${p.total} € a bien été enregistrée.</p>`,
      };
    }
    case "PAYMENT_RECEIVED": {
      const p = payload as TemplatePayloads["PAYMENT_RECEIVED"];
      return {
        subject: `Paiement reçu — commande ${p.orderNumber}`,
        html: `<p>Bonjour ${p.firstName},</p><p>Nous avons bien reçu votre paiement de ${p.amount} € pour la commande ${p.orderNumber}.</p>`,
      };
    }
    case "ORDER_READY": {
      const p = payload as TemplatePayloads["ORDER_READY"];
      return {
        subject: `Commande ${p.orderNumber} prête`,
        html: `<p>Bonjour ${p.firstName},</p><p>Votre commande ${p.orderNumber} est prête à être expédiée.</p>`,
      };
    }
    case "ORDER_SHIPPED": {
      const p = payload as TemplatePayloads["ORDER_SHIPPED"];
      return {
        subject: `Commande ${p.orderNumber} expédiée`,
        html: `<p>Bonjour ${p.firstName},</p><p>Votre commande ${p.orderNumber} a été expédiée.${
          p.trackingUrl ? ` Suivi : <a href="${p.trackingUrl}">${p.trackingUrl}</a>` : ""
        }</p>`,
      };
    }
    case "ORDER_DELIVERED": {
      const p = payload as TemplatePayloads["ORDER_DELIVERED"];
      return {
        subject: `Commande ${p.orderNumber} livrée`,
        html: `<p>Bonjour ${p.firstName},</p><p>Votre commande ${p.orderNumber} a été livrée. Merci pour votre confiance !</p>`,
      };
    }
    default: {
      const exhaustive: never = template;
      throw new Error(`Template inconnu: ${exhaustive}`);
    }
  }
}
