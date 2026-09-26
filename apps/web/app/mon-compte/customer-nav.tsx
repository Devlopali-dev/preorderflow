import Link from "next/link";
import { CustomerLogoutButton } from "./customer-logout-button";

export function CustomerNav() {
  return (
    <nav className="flex items-center justify-between border-b p-4 text-sm">
      <div className="flex gap-4">
        <Link href="/mon-compte">Mes commandes</Link>
        <Link href="/mon-compte/profil">Mon profil</Link>
      </div>
      <CustomerLogoutButton />
    </nav>
  );
}
