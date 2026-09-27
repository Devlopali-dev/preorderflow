import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex items-center justify-between border-b p-4 text-sm">
        <div className="flex gap-4">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/orders">Commandes</Link>
          <Link href="/customers">Clients</Link>
          <Link href="/inventory">Stock</Link>
          <Link href="/production">Production</Link>
          <Link href="/shipments">Expéditions</Link>
          <Link href="/audit-logs">Audit</Link>
        </div>
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
