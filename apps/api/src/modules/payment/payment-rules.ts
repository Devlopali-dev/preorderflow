// Une commande annulée ou remboursée est close côté paiement : on ne génère plus
// de paiement ni n'en confirme un, depuis l'administration. Sans ce garde, un
// paiement en attente d'une commande annulée pouvait être confirmé : le
// paiement passait à « payé » en base, puis le passage de la commande à
// « payée » échouait (transition invalide), laissant un paiement payé sur une
// commande annulée.

export class OrderNotPayableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderNotPayableError";
  }
}

const NOT_PAYABLE_MESSAGES: Record<string, string> = {
  CANCELLED: "Cette commande est annulée : son paiement est en lecture seule",
  REFUNDED: "Cette commande est remboursée : son paiement est en lecture seule",
};

export function assertOrderAcceptsPayment(orderStatus: string): void {
  const message = NOT_PAYABLE_MESSAGES[orderStatus];
  if (message) {
    throw new OrderNotPayableError(message);
  }
}
