"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import { ProductCreateModal } from "./product-create-modal";

export function CreateProductButton({ apiUrl }: { apiUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouveau produit
      </Button>
      {open && <ProductCreateModal apiUrl={apiUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
