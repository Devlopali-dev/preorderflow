"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Color, Product, ProductVariant } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { ColorLabel } from "@/components/color-label";

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
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>(product.variants);
  const [colors, setColors] = useState<Color[]>([]);
  const [newColorId, setNewColorId] = useState("");

  // Palette globale (/settings) : chargée à l'ouverture pour proposer les
  // couleurs pas encore utilisées par ce produit.
  useEffect(() => {
    fetch(`${apiUrl}/api/v1/colors`, { headers: { ...getClientAuthHeaders() } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setColors)
      .catch(() => setColors([]));
  }, [apiUrl]);

  const usedColorIds = new Set(variants.map((variant) => variant.colorId));
  const availableColors = colors.filter((color) => color.active && !usedColorIds.has(color.id));

  // Recharge les variantes depuis l'API : l'ajout d'une première couleur peut
  // retirer la variante par défaut inutilisée, à ne pas deviner côté client.
  async function refreshVariants() {
    const res = await fetch(`${apiUrl}/api/v1/products/${product.id}`);
    if (res.ok) setVariants((await res.json()).variants);
    router.refresh();
  }

  async function variantRequest(
    url: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      await refreshVariants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant() {
    await variantRequest(`${apiUrl}/api/v1/products/${product.id}/variants`, "POST", {
      colorId: newColorId,
    });
    setNewColorId("");
  }

  function handleToggleVariant(variant: ProductVariant) {
    return variantRequest(
      `${apiUrl}/api/v1/products/${product.id}/variants/${variant.id}`,
      "PATCH",
      {
        active: !variant.active,
      },
    );
  }

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

  async function handleUploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiUrl}/api/v1/products/${product.id}/photo`, {
        method: "POST",
        headers: { ...getClientAuthHeaders() },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      const updated = await res.json();
      setImageUrl(updated.imageUrl);
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
              patch({
                name,
                description,
                price: Number(price),
              })
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <Input
            placeholder="Description"
            value={description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
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
        <div className="flex flex-col gap-2 text-sm">
          <span>Couleurs</span>
          <ul className="flex flex-col gap-1">
            {variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ColorLabel
                    name={variant.color?.name ?? "Standard (sans couleur)"}
                    hex={variant.color?.hex}
                    inactive={!variant.active || variant.color?.active === false}
                  />
                  <span className="opacity-60">{variant.sku}</span>
                </span>
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => handleToggleVariant(variant)}
                >
                  {variant.active ? "Désactiver" : "Activer"}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <select
              className="select flex-1"
              aria-label="Ajouter une couleur"
              value={newColorId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewColorId(e.target.value)}
            >
              <option value="">Ajouter une couleur…</option>
              {availableColors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" disabled={saving || !newColorId} onClick={handleAddVariant}>
              Ajouter
            </Button>
          </div>
          {colors.length === 0 && (
            <p className="text-xs opacity-60">
              Aucune couleur dans la palette : créez-en dans les paramètres.
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Photo
          {imageUrl && (
            <img src={`${apiUrl}${imageUrl}`} alt="" className="h-24 w-24 rounded object-cover" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadPhoto}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
