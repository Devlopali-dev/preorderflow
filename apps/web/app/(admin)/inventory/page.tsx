import { getInventory, getProducts } from "@/lib/api";
import { ProductNameButton } from "./product-name-button";
import { CreateProductButton } from "./create-product-button";

export default async function InventoryPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [rows, products] = await Promise.all([getInventory(), getProducts()]);
  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock</h1>
        <CreateProductButton apiUrl={apiUrl} />
      </div>
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
          {rows.map((row) => {
            const product = productById.get(row.product.id);
            return (
              <tr key={row.product.id} className="border-b">
                <td className="py-2">
                  {product ? (
                    <ProductNameButton product={product} apiUrl={apiUrl} />
                  ) : (
                    row.product.name
                  )}
                  {product && !product.active && (
                    <span className="badge badge-default ml-2">archivé</span>
                  )}
                </td>
                <td className="py-2">{row.stock.physicalStock}</td>
                <td className="py-2">{row.stock.reservedStock}</td>
                <td className="py-2">{row.stock.availableStock}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
