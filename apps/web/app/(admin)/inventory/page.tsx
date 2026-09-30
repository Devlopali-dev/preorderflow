import { Fragment } from "react";
import { getInventory, getProducts } from "@/lib/api";
import { ProductNameButton } from "./product-name-button";
import { CreateProductButton } from "./create-product-button";

export default async function InventoryPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [rows, products] = await Promise.all([getInventory(), getProducts()]);
  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produits</h1>
          <p className="card-subtitle">
            {rows.length} produit{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateProductButton apiUrl={apiUrl} />
      </div>

      {rows.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucun produit</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th style={{ textAlign: "center" }}>Stock physique</th>
                <th style={{ textAlign: "center" }}>Réservé</th>
                <th style={{ textAlign: "center" }}>Disponible</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const product = productById.get(row.product.id);
                // Détail par couleur seulement quand il y a un vrai choix ;
                // un produit à variante unique garde sa ligne unique.
                const showVariants =
                  row.variants.length > 1 || row.variants.some((v) => v.variant.color);
                return (
                  <Fragment key={row.product.id}>
                    <tr>
                      <td>
                        {product ? (
                          <ProductNameButton product={product} apiUrl={apiUrl} />
                        ) : (
                          row.product.name
                        )}
                        {product && !product.active && (
                          <span className="badge badge-default ml-2">archivé</span>
                        )}
                      </td>
                      <td className="text-center">{row.stock.physicalStock}</td>
                      <td className="text-center">{row.stock.reservedStock}</td>
                      <td className="text-center">{row.stock.availableStock}</td>
                    </tr>
                    {showVariants &&
                      row.variants.map(({ variant, stock }) => (
                        <tr key={variant.id} className="text-sm opacity-80">
                          <td className="pl-8">
                            <span className="flex items-center gap-2">
                              {variant.color && (
                                <span
                                  aria-hidden="true"
                                  className="inline-block h-3 w-3 rounded-full border"
                                  style={{ backgroundColor: variant.color.hex }}
                                />
                              )}
                              {variant.color?.name ?? "Standard"}
                              {!variant.active && (
                                <span className="badge badge-default">inactive</span>
                              )}
                            </span>
                          </td>
                          <td className="text-center">{stock.physicalStock}</td>
                          <td className="text-center">{stock.reservedStock}</td>
                          <td className="text-center">{stock.availableStock}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
