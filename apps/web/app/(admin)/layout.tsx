import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { NAV_LINKS } from "./nav-links";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="relative flex items-center justify-between border-b p-4 text-sm">
        <MobileNav />
        <div className="hidden gap-4 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/settings">Paramètres</Link>
          <LogoutButton />
        </div>
      </nav>
      {children}
    </div>
  );
}
