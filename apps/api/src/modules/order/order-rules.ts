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
