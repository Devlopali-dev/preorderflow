import { getInventory } from "@/lib/api";

export default async function InventoryPage() {
  const rows = await getInventory();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Stock</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Produit</th>
            <th className="py-2">Stock physique</th>
            <th className="py-2">Réservé</th>
            <th className="py-2">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product.id} className="border-b">
              <td className="py-2">{row.product.name}</td>
              <td className="py-2">{row.stock.physicalStock}</td>
              <td className="py-2">{row.stock.reservedStock}</td>
              <td className="py-2">{row.stock.availableStock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
