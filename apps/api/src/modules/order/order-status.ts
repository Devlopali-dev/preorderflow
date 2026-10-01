import { OrderStatus } from "@preorderflow/database";

// cf. docs/architecture.md §4.2
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["READY_TO_SHIP", "REFUNDED"],
  READY_TO_SHIP: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: [], // commande livrée : lecture seule
  CANCELLED: [],
  REFUNDED: [],
};

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Transition de commande invalide: ${from} -> ${to}`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertValidOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
