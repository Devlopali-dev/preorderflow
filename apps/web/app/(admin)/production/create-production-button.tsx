"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { NoProductNotice } from "@/components/no-product-notice";
import { ProductionCreateModal } from "./production-create-modal";

export function CreateProductionButton({
  apiUrl,
  products,
}: {
  apiUrl: string;
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  return (
    <div className="flex flex-col items-end">
      <Button
        variant="primary"
        onClick={() => (products.length === 0 ? setShowNotice(true) : setOpen(true))}
      >
        Nouvelle production
      </Button>
      {showNotice && products.length === 0 && <NoProductNotice what="planifier une production" />}
      {open && (
        <ProductionCreateModal apiUrl={apiUrl} products={products} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
