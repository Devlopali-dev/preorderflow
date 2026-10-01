"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  header,
  defaultOpen = true,
  id,
  children,
}: {
  header: ReactNode;
  defaultOpen?: boolean;
  // Ancre de la section (ex. `/orders#orders-PAID`) : le lien arrive sur elle.
  id?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-fit items-center gap-2 text-left"
      >
        {header}
        <span className="table-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </section>
  );
}
