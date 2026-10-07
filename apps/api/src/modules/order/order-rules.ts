// Une commande ne peut être livrée que si elle est payée. Le statut « payée » à
// lui seul ne suffit pas : il peut être posé à la main sans paiement
// enregistré, auquel cas `paymentStatus` reste « UNPAID ».

export class OrderNotPaidError extends Error {
  constructor(paymentStatus: string) {
    super(`Une commande non payée ne peut pas être livrée (paiement : ${paymentStatus})`);
    this.name = "OrderNotPaidError";
  }
}

export function assertOrderPaidForDelivery(paymentStatus: string): void {
  if (paymentStatus !== "PAID") {
    throw new OrderNotPaidError(paymentStatus);
  }
}

// Remise en main propre : la commande passe directement à « livrée », sans expédition. Possible
// tant qu'elle est en préparation ou prête, jamais avant (pas encore payée) ni après.
export const HAND_DELIVERY_FROM_STATUSES = ["PROCESSING", "READY_TO_SHIP"];

export class OrderNotHandDeliverableError extends Error {
  constructor(status: string) {
    super(
      `La remise en main propre n'est possible que pour une commande en préparation ou prête à expédier (statut actuel : ${status})`,
    );
    this.name = "OrderNotHandDeliverableError";
  }
}

export function assertOrderHandDeliverable(status: string): void {
  if (!HAND_DELIVERY_FROM_STATUSES.includes(status)) {
    throw new OrderNotHandDeliverableError(status);
  }
}
