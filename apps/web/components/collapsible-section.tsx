"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  header,
  defaultOpen = true,
  children,
}: {
  header: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="flex flex-col gap-3">
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
