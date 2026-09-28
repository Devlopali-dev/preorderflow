import type { CampaignMedia } from "@/lib/api";

function toFullUrl(url: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return url.startsWith("http") ? url : `${apiUrl}${url}`;
}

export function MediaGallery({ media }: { media: CampaignMedia[] }) {
  if (media.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
      {media.map((item) =>
        item.type === "DOCUMENT" && item.thumbnailUrl ? (
          <a
            key={item.id}
            href={toFullUrl(item.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-lg"
          >
            <img
              src={toFullUrl(item.thumbnailUrl)}
              alt="Aperçu du document PDF"
              loading="lazy"
              className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]"
            />
          </a>
        ) : item.type === "DOCUMENT" ? (
          <a
            key={item.id}
            href={toFullUrl(item.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-bg-subtle p-4 text-center text-sm font-medium text-neutral-600 transition hover:opacity-80 dark:border-neutral-700 dark:text-neutral-300"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-70"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span>Document PDF</span>
          </a>
        ) : (
          <a
            key={item.id}
            href={toFullUrl(item.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="overflow-hidden rounded-lg"
          >
            <img
              src={toFullUrl(item.url)}
              alt=""
              loading="lazy"
              className="aspect-[3/4] w-full object-cover transition hover:scale-[1.02]"
            />
          </a>
        ),
      )}
    </div>
  );
}
