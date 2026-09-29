"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { NoProductNotice } from "@/components/no-product-notice";
import { CampaignCreateModal } from "./campaign-create-modal";

export function CreateCampaignButton({
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
        Nouvelle campagne
      </Button>
      {showNotice && products.length === 0 && <NoProductNotice what="créer une campagne" />}
      {open && (
        <CampaignCreateModal apiUrl={apiUrl} products={products} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
