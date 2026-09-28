"use client";

import { useState } from "react";
import { CustomerDetailModal } from "./customer-detail-modal";

export function CustomerRowButton({
  customerId,
  label,
  apiUrl,
}: {
  customerId: string;
  label: string;
  apiUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <CustomerDetailModal
          customerId={customerId}
          apiUrl={apiUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
