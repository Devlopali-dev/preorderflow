"use client";

import { useState } from "react";
import Link from "next/link";

import { NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 flex-col items-center justify-center gap-1"
      >
        <span className="block h-0.5 w-5 bg-current" />
        <span className="block h-0.5 w-5 bg-current" />
        <span className="block h-0.5 w-5 bg-current" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-1 border-b bg-[var(--color-surface)] p-4">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
