"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampaignMedia, ProductPhoto } from "@/lib/api";

function toFullUrl(url: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return url.startsWith("http") ? url : `${apiUrl}${url}`;
}

// Même tuile pour tout : coins arrondis et bordure du `card` du formulaire.
const TILE = "card block overflow-hidden";

interface GalleryImage {
  key: string;
  url: string;
  alt: string;
}

function ImageTile({
  image,
  className,
  onOpen,
}: {
  image: GalleryImage;
  className: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Agrandir : ${image.alt}`}
      className={`${TILE} w-full cursor-zoom-in p-0`}
    >
      <img
        src={toFullUrl(image.url)}
        alt={image.alt}
        loading="lazy"
        className={`w-full object-cover transition hover:scale-[1.02] ${className}`}
      />
    </button>
  );
}

function DocumentTile({ item }: { item: CampaignMedia }) {
  if (item.thumbnailUrl) {
    return (
      <a href={toFullUrl(item.url)} target="_blank" rel="noopener noreferrer" className={TILE}>
        <img
          src={toFullUrl(item.thumbnailUrl)}
          alt="Aperçu du document PDF"
          loading="lazy"
          className="aspect-[3/4] w-full object-cover transition hover:scale-[1.02]"
        />
      </a>
    );
  }
  return (
    <a
      href={toFullUrl(item.url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${TILE} flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-bg-subtle p-4 text-center text-sm font-medium transition hover:opacity-80`}
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
  );
}

// Visionneuse interne : l'image s'agrandit dans la page, sans nouvel onglet.
function Lightbox({
  images,
  index,
  onClose,
  onChange,
}: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const count = images.length;
  const current = images[index]!;
  const previous = useCallback(
    () => onChange((index - 1 + count) % count),
    [index, count, onChange],
  );
  const next = useCallback(() => onChange((index + 1) % count), [index, count, onChange]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) previous();
      else if (e.key === "ArrowRight" && count > 1) next();
    }
    document.addEventListener("keydown", onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose, previous, next, count]);

  const control =
    "absolute rounded-full bg-black/60 px-3 py-2 text-lg leading-none text-white hover:bg-black/80";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse de photos"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <img
        src={toFullUrl(current.url)}
        alt={current.alt}
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        aria-label="Fermer"
        className={`${control} right-4 top-4`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            className={`${control} left-4 top-1/2 -translate-y-1/2`}
            onClick={(e) => {
              e.stopPropagation();
              previous();
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            className={`${control} right-4 top-1/2 -translate-y-1/2`}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            ›
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {count}
          </p>
        </>
      )}
    </div>
  );
}

// Photos du produit d'abord (la première en grand), puis les médias de la campagne.
export function MediaGallery({
  photos = [],
  media,
}: {
  photos?: ProductPhoto[];
  media: CampaignMedia[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  if (photos.length === 0 && media.length === 0) return null;

  // Images parcourables dans la visionneuse, dans l'ordre d'affichage.
  const productImages: GalleryImage[] = photos.map((photo) => ({
    key: photo.id,
    url: photo.url,
    alt: "Photo du produit",
  }));
  const campaignImages: GalleryImage[] = media
    .filter((item) => item.type === "IMAGE")
    .map((item) => ({ key: item.id, url: item.url, alt: "Photo de la campagne" }));
  const images = [...productImages, ...campaignImages];
  const indexOf = (key: string) => images.findIndex((image) => image.key === key);

  const [main, ...otherPhotos] = productImages;

  return (
    <div className="flex flex-col gap-3">
      {main && (
        <ImageTile
          image={main}
          className="aspect-[4/3]"
          onOpen={() => setOpenIndex(indexOf(main.key))}
        />
      )}
      {(otherPhotos.length > 0 || media.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
          {otherPhotos.map((image) => (
            <ImageTile
              key={image.key}
              image={image}
              className="aspect-[3/4]"
              onOpen={() => setOpenIndex(indexOf(image.key))}
            />
          ))}
          {media.map((item) =>
            item.type === "DOCUMENT" ? (
              <DocumentTile key={item.id} item={item} />
            ) : (
              <ImageTile
                key={item.id}
                image={{ key: item.id, url: item.url, alt: "Photo de la campagne" }}
                className="aspect-[3/4]"
                onOpen={() => setOpenIndex(indexOf(item.id))}
              />
            ),
          )}
        </div>
      )}
      {openIndex !== null && (
        <Lightbox images={images} index={openIndex} onClose={close} onChange={setOpenIndex} />
      )}
    </div>
  );
}
