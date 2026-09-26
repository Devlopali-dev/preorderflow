import { ProductionBatchStatus } from "@preorderflow/database";

const ALLOWED_TRANSITIONS: Record<ProductionBatchStatus, ProductionBatchStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PARTIALLY_COMPLETED", "COMPLETED", "CANCELLED"],
  PARTIALLY_COMPLETED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class InvalidProductionTransitionError extends Error {
  constructor(from: ProductionBatchStatus, to: ProductionBatchStatus) {
    super(`Transition de production invalide: ${from} -> ${to}`);
    this.name = "InvalidProductionTransitionError";
  }
}

export function assertValidProductionTransition(
  from: ProductionBatchStatus,
  to: ProductionBatchStatus,
): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidProductionTransitionError(from, to);
  }
}

// Détermine le statut final à partir des quantités produites déclarées.
export function computeCompletionStatus(
  items: Array<{ quantityPlanned: number; quantityProduced: number }>,
): "COMPLETED" | "PARTIALLY_COMPLETED" {
  const fullyProduced = items.every((item) => item.quantityProduced >= item.quantityPlanned);
  return fullyProduced ? "COMPLETED" : "PARTIALLY_COMPLETED";
}
