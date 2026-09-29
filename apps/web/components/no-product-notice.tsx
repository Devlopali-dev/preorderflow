import Link from "next/link";

export function NoProductNotice({ what }: { what: string }) {
  return (
    <p role="alert" className="mt-2 text-sm text-[var(--color-warning)]">
      Aucun produit n&apos;existe : créez d&apos;abord un produit pour {what}.{" "}
      <Link href="/inventory" className="underline">
        Créer un produit
      </Link>
    </p>
  );
}
