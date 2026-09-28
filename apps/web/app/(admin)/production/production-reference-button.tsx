"use client";

import { useState } from "react";
import type { ProductionBatchSummary } from "@/lib/api";
import { ProductionEditModal } from "./production-edit-modal";

export function ProductionReferenceButton({
  batch,
  apiUrl,
}: {
  batch: ProductionBatchSummary;
  apiUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {batch.reference}
      </button>
      {open && <ProductionEditModal batch={batch} apiUrl={apiUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
