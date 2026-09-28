"use client";

import { useState } from "react";
import { Button } from "@preorderflow/ui";
import { CustomerCreateModal } from "./customer-create-modal";

export function CreateCustomerButton({ apiUrl }: { apiUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nouveau client
      </Button>
      {open && <CustomerCreateModal apiUrl={apiUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
