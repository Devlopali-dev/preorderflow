import { getProductionBatches, getProducts } from "@/lib/api";
import { ProductionReferenceButton } from "./production-reference-button";
import { CreateProductionButton } from "./create-production-button";
import { ProductionIncrementButtons } from "./production-increment-buttons";
import { ProductionStartButton } from "./production-start-button";

const BATCH_STATUS_ORDER = [
  "PLANNED",
  "IN_PROGRESS",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "CANCELLED",
];

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

  const groups = BATCH_STATUS_ORDER.map((status) => ({
    status,
    batches: batches.filter((batch) => batch.status === status),
  })).filter((group) => group.batches.length > 0);

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

      {groups.length === 0 && (
        <div className="card card-body text-center text-sm opacity-60">Aucun lot de production</div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`badge ${BATCH_BADGE[group.status] ?? "badge-default"}`}>
                {group.status}
              </span>
              <span className="table-muted">{group.batches.length}</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Produit</th>
                    <th style={{ textAlign: "center" }}>Prévu</th>
                    <th style={{ textAlign: "center" }}>Fabriqué</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.batches.map((batch) => {
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
                        <td className="text-center">{planned}</td>
                        <td className="text-center">{produced}</td>
                        <td className="text-center">
                          <div className="table-cell-actions justify-center">
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
          </section>
        ))}
      </div>
    </main>
  );
}
