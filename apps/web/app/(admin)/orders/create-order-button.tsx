"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { CustomerSummary, Product } from "@/lib/api";
import { OrderCreateModal } from "./order-create-modal";

export function CreateOrderButton({
  apiUrl,
  products,
  customers,
}: {
  apiUrl: string;
  products: Product[];
  customers: CustomerSummary[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouvelle commande
      </Button>
      {open && (
        <OrderCreateModal
          apiUrl={apiUrl}
          products={products}
          customers={customers}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
