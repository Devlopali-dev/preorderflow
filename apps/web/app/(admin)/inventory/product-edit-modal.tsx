"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function ProductEditModal({
  product,
  apiUrl,
  onClose,
}: {
  product: Product;
  apiUrl: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(String(product.price));
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(product.documentUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(body),
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

  async function handleArchive() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/products/${product.id}/archive`, {
        method: "PATCH",
        headers: { ...getClientAuthHeaders() },
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
      title={`Produit — ${product.sku}`}
      footer={
        <>
          {product.active && (
            <Button variant="danger" loading={saving} onClick={handleArchive}>
              Archiver
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() =>
              patch({ name, description, price: Number(price), imageUrl: imageUrl || undefined, documentUrl: documentUrl || undefined })
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Nom"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <Input
          placeholder="Description"
          value={description}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          placeholder="Prix"
          value={price}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
        />
        <Input
          placeholder="URL de la photo"
          value={imageUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
        />
        <Input
          placeholder="URL du PDF de présentation"
          value={documentUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDocumentUrl(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
