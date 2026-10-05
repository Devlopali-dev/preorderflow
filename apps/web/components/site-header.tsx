import Link from "next/link";

// En-tête des écrans clients publics (accueil, page campagne).
export function SiteHeader() {
  return (
    <header className="border-b">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex max-w-5xl items-center justify-between p-4 text-sm"
      >
        <Link href="/" className="font-semibold no-underline">
          PreOrderFlow
        </Link>
      </nav>
    </header>
  );
}
