import { ProductionBatchStatus } from "@preorderflow/database";

// Corriger une production (retirer des unités déjà déclarées produites).
//
// Le stock est dérivé des mouvements : on ne réécrit jamais l'historique, on
// ajoute un mouvement négatif. Ces règles protègent l'intégrité du stock.

export class InvalidDecrementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDecrementError";
  }
}

// Seul un lot en cours peut être corrigé : un lot terminé est clos (sa
// production a été validée), un lot planifié ou annulé n'a rien produit.
const CORRECTABLE_STATUSES: ProductionBatchStatus[] = ["IN_PROGRESS", "PARTIALLY_COMPLETED"];

export function assertCanDecrement(input: {
  status: ProductionBatchStatus;
  quantityProduced: number;
  quantity: number;
  physicalStock: number;
}): void {
  const { status, quantityProduced, quantity, physicalStock } = input;

  if (!CORRECTABLE_STATUSES.includes(status)) {
    throw new InvalidDecrementError(
      "Seule la production d'un lot en cours peut être corrigée (lot planifié, terminé ou annulé)",
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidDecrementError("La quantité à retirer doit être un entier d'au moins 1");
  }
  if (quantity > quantityProduced) {
    throw new InvalidDecrementError(
      `Impossible de retirer ${quantity} : seulement ${quantityProduced} produit(s) enregistré(s) sur ce lot`,
    );
  }
  // Le stock physique ne devient jamais négatif : si ces unités ont déjà quitté
  // le stock (ajustement, casse), retirer la production le ferait passer sous 0.
  if (physicalStock < quantity) {
    throw new InvalidDecrementError(
      `Stock physique insuffisant pour retirer ${quantity} unité(s) (stock actuel : ${physicalStock})`,
    );
  }
}
