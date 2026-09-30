import { Fragment } from "react";
import { getInventory, getProducts, type InventoryRow, type Product } from "@/lib/api";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ColorLabel } from "@/components/color-label";
import { ProductNameButton } from "./product-name-button";
import { CreateProductButton } from "./create-product-button";

function ProductsTable({
  rows,
  productById,
  apiUrl,
}: {
  rows: InventoryRow[];
  productById: Map<string, Product>;
  apiUrl: string;
}) {
  return (
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
                  </td>
                  <td className="text-center">{row.stock.physicalStock}</td>
                  <td className="text-center">{row.stock.reservedStock}</td>
                  <td className="text-center">{row.stock.availableStock}</td>
                </tr>
                {showVariants &&
                  row.variants.map(({ variant, stock }) => (
                    <tr key={variant.id} className="text-sm opacity-90">
                      {/* Retrait : la ligne d'une couleur se lit comme un détail du produit. */}
                      <td className="pl-10">
                        <ColorLabel
                          name={variant.color?.name ?? "Standard"}
                          hex={variant.color?.hex}
                          inactive={!variant.active || variant.color?.active === false}
                          size="sm"
                        />
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
  );
}

export default async function InventoryPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [rows, products] = await Promise.all([getInventory(), getProducts()]);
  const productById = new Map(products.map((p) => [p.id, p]));

  // Un produit archivé (active = false) sort du tableau principal.
  const isArchived = (row: InventoryRow) => productById.get(row.product.id)?.active === false;
  const activeRows = rows.filter((row) => !isArchived(row));
  const archivedRows = rows.filter(isArchived);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produits</h1>
          <p className="card-subtitle">
            {activeRows.length} produit{activeRows.length > 1 ? "s" : ""} actif
            {activeRows.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateProductButton apiUrl={apiUrl} />
      </div>

      {activeRows.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucun produit actif</div>
      ) : (
        <ProductsTable rows={activeRows} productById={productById} apiUrl={apiUrl} />
      )}

      {archivedRows.length > 0 && (
        <CollapsibleSection
          defaultOpen={false}
          header={<h2 className="text-lg font-semibold">Archivés ({archivedRows.length})</h2>}
        >
          <ProductsTable rows={archivedRows} productById={productById} apiUrl={apiUrl} />
        </CollapsibleSection>
      )}
    </main>
  );
}
