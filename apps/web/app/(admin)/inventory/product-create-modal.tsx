"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import { getClientAuthHeaders } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

export function ProductCreateModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Tant que le slug n'a pas été modifié à la main, il suit le nom.
  const [slugEdited, setSlugEdited] = useState(false);
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          sku,
          name,
          slug,
          price: Number(price),
          imageUrl: imageUrl || undefined,
          documentUrl: documentUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nouveau produit"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>
            Créer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          SKU
          <Input
            placeholder="SKU"
            value={sku}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSku(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <Input
            placeholder="Slug"
            value={slug}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prix
          <Input
            type="number"
            step="0.01"
            placeholder="Prix"
            value={price}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          URL de la photo
          <Input
            placeholder="URL de la photo"
            value={imageUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          URL du PDF de présentation
          <Input
            placeholder="URL du PDF de présentation"
            value={documentUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDocumentUrl(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
