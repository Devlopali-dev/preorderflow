"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { ProductionCreateModal } from "./production-create-modal";

export function CreateProductionButton({ apiUrl, products }: { apiUrl: string; products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouvelle production
      </Button>
      {open && <ProductionCreateModal apiUrl={apiUrl} products={products} onClose={() => setOpen(false)} />}
    </>
  );
}
