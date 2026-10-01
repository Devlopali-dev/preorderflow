"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Campaign, CustomerSummary, Product } from "@/lib/api";
import { NoProductNotice } from "@/components/no-product-notice";
import { OrderCreateModal } from "./order-create-modal";

export function CreateOrderButton({
  apiUrl,
  products,
  customers,
  campaigns,
}: {
  apiUrl: string;
  products: Product[];
  customers: CustomerSummary[];
  campaigns: Campaign[];
}) {
  const [open, setOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  return (
    <div className="flex flex-col items-end">
      <Button
        variant="primary"
        onClick={() => (products.length === 0 ? setShowNotice(true) : setOpen(true))}
      >
        Nouvelle commande
      </Button>
      {showNotice && products.length === 0 && <NoProductNotice what="créer une commande" />}
      {open && (
        <OrderCreateModal
          apiUrl={apiUrl}
          products={products}
          customers={customers}
          campaigns={campaigns}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
