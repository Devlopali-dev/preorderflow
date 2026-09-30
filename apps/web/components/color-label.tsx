// Pastille + nom d'une couleur. Une couleur (ou variante) inactive s'affiche en
// italique avec un badge d'avertissement orange, partout de la même façon.
// Sans hook : utilisable côté serveur comme côté client.

export function InactiveBadge() {
  return (
    <span className="badge badge-warning inline-flex items-center gap-1">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="currentColor"
        style={{ color: "var(--color-warning)" }}
      >
        <path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" />
      </svg>
      inactive
    </span>
  );
}

export function ColorLabel({
  name,
  hex,
  inactive = false,
  size = "md",
}: {
  name: string;
  hex?: string | null;
  inactive?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {hex && (
        <span
          aria-hidden="true"
          className={`inline-block rounded-full border ${size === "sm" ? "h-3 w-3" : "h-4 w-4"}`}
          style={{ backgroundColor: hex }}
        />
      )}
      <span className={inactive ? "italic opacity-70" : undefined}>{name}</span>
      {inactive && <InactiveBadge />}
    </span>
  );
}
