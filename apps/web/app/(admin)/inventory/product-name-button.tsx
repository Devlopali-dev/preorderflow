"use client";

import { useState } from "react";
import type { Product } from "@/lib/api";
import { ProductEditModal } from "./product-edit-modal";

export function ProductNameButton({ product, apiUrl }: { product: Product; apiUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {product.name}
      </button>
      {open && <ProductEditModal product={product} apiUrl={apiUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
