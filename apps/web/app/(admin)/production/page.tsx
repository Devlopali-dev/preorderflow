import { getProductionBatches } from "@/lib/api";

export default async function ProductionPage() {
  const batches = await getProductionBatches();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Production</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Référence</th>
            <th className="py-2">Produit</th>
            <th className="py-2">Statut</th>
            <th className="py-2">Prévu</th>
            <th className="py-2">Fabriqué</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const planned = batch.items.reduce((sum, i) => sum + i.quantityPlanned, 0);
            const produced = batch.items.reduce((sum, i) => sum + i.quantityProduced, 0);
            const productNames = [...new Set(batch.items.map((i) => i.product.name))].join(", ");
            return (
              <tr key={batch.id} className="border-b">
                <td className="py-2">{batch.reference}</td>
                <td className="py-2">{productNames}</td>
                <td className="py-2">{batch.status}</td>
                <td className="py-2">{planned}</td>
                <td className="py-2">{produced}</td>
              </tr>
            );
          })}
          {batches.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center opacity-60">
                Aucun lot de production
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
