import { getProductionBatches, getProducts } from "@/lib/api";
import { ProductionReferenceButton } from "./production-reference-button";
import { CreateProductionButton } from "./create-production-button";
import { ProductionIncrementButtons } from "./production-increment-buttons";
import { ProductionStartButton } from "./production-start-button";

const BATCH_BADGE: Record<string, string> = {
  PLANNED: "badge-default",
  IN_PROGRESS: "badge-primary",
  PARTIALLY_COMPLETED: "badge-warning",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
};

export default async function ProductionPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [batches, products] = await Promise.all([getProductionBatches(), getProducts()]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production</h1>
          <p className="card-subtitle">
            {batches.length} lot{batches.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateProductionButton apiUrl={apiUrl} products={products} />
      </div>

      {batches.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucun lot de production</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Produit</th>
                <th>Statut</th>
                <th>Prévu</th>
                <th>Fabriqué</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const planned = batch.items.reduce((sum, i) => sum + i.quantityPlanned, 0);
                const produced = batch.items.reduce((sum, i) => sum + i.quantityProduced, 0);
                const productNames = [...new Set(batch.items.map((i) => i.product.name))].join(
                  ", ",
                );
                return (
                  <tr key={batch.id}>
                    <td>
                      <ProductionReferenceButton batch={batch} apiUrl={apiUrl} />
                    </td>
                    <td>{productNames}</td>
                    <td>
                      <span className={`badge ${BATCH_BADGE[batch.status] ?? "badge-default"}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td>{planned}</td>
                    <td>{produced}</td>
                    <td>
                      <div className="table-cell-actions">
                        {batch.status === "PLANNED" && (
                          <ProductionStartButton batchId={batch.id} apiUrl={apiUrl} />
                        )}
                        <ProductionIncrementButtons batch={batch} apiUrl={apiUrl} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
