import { ShipmentStatus } from "@preorderflow/database";

// cf. docs/architecture.md §16 / cahier des charges §16
const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["LABEL_CREATED", "SHIPPED"],
  LABEL_CREATED: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RETURNED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "EXCEPTION", "RETURNED"],
  DELIVERED: [],
  EXCEPTION: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  RETURNED: [],
};

export class InvalidShipmentTransitionError extends Error {
  constructor(from: ShipmentStatus, to: ShipmentStatus) {
    super(`Transition d'expédition invalide: ${from} -> ${to}`);
    this.name = "InvalidShipmentTransitionError";
  }
}

export function assertValidShipmentTransition(from: ShipmentStatus, to: ShipmentStatus): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidShipmentTransitionError(from, to);
  }
}
