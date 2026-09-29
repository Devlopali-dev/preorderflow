"use client";

import { useState } from "react";
import { OrderDetailModal } from "./order-detail-modal";

export function OrderRowButton({
  orderId,
  label,
  apiUrl,
}: {
  orderId: string;
  label: string;
  apiUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-link" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <OrderDetailModal orderId={orderId} apiUrl={apiUrl} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
