"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { OrderCreateModal } from "./order-create-modal";

export function CreateOrderButton({ apiUrl, products }: { apiUrl: string; products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouvelle commande
      </Button>
      {open && <OrderCreateModal apiUrl={apiUrl} products={products} onClose={() => setOpen(false)} />}
    </>
  );
}
