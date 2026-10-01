// Le client choisit lui-même de payer (ou de payer plus tard) tant que sa
// commande n'est pas réglée : brouillon ou en attente de paiement. Au-delà
// (payée, en préparation, annulée…), plus de choix à faire.

export class PaymentChoiceClosedError extends Error {
  constructor() {
    super("Cette commande ne peut plus être réglée en ligne");
    this.name = "PaymentChoiceClosedError";
  }
}

const OPEN_STATUSES = ["DRAFT", "PENDING_PAYMENT"];

export function assertPaymentChoiceOpen(orderStatus: string): void {
  if (!OPEN_STATUSES.includes(orderStatus)) {
    throw new PaymentChoiceClosedError();
  }
}
