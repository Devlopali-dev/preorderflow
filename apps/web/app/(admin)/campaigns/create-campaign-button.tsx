"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { CampaignCreateModal } from "./campaign-create-modal";

export function CreateCampaignButton({ apiUrl, products }: { apiUrl: string; products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouvelle campagne
      </Button>
      {open && <CampaignCreateModal apiUrl={apiUrl} products={products} onClose={() => setOpen(false)} />}
    </>
  );
}
