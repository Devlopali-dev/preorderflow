// Le stock n'est jamais stocké : toujours dérivé des mouvements et des
// commandes réservantes (cf. docs/architecture.md §3 / CLAUDE.md §13).

export interface StockSnapshot {
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}

export function computeStockSnapshot(movementQuantities: number[], reservedQuantities: number[]): StockSnapshot {
  const physicalStock = movementQuantities.reduce((sum, q) => sum + q, 0);
  const reservedStock = reservedQuantities.reduce((sum, q) => sum + q, 0);
  return {
    physicalStock,
    reservedStock,
    availableStock: physicalStock - reservedStock,
  };
}
