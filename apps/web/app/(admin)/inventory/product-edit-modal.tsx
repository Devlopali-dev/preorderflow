"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Color, Product, ProductPhoto, ProductVariant } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { MAX_PRODUCT_PHOTOS } from "@/lib/product-photos";
import { ProductColorPicker } from "@/components/product-color-picker";

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
  const [photos, setPhotos] = useState<ProductPhoto[]>(product.photos ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>(product.variants);
  const [colors, setColors] = useState<Color[]>([]);
  const [colorsLoaded, setColorsLoaded] = useState(false);

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

  // Choisir une couleur dans la liste l'ajoute aussitôt : pas de second geste.
  async function handleAddVariant(colorId: string) {
    await variantRequest(`${apiUrl}/api/v1/products/${product.id}/variants`, "POST", { colorId });
  }

  // Palette globale, rechargée quand on la modifie ici. Une couleur créée par
  // le picker est ajoutée d'office au produit (onCreated), comme à la création.
  const loadColors = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/colors`, {
        headers: { ...getClientAuthHeaders() },
      });
      setColors(res.ok ? await res.json() : []);
    } catch {
      setColors([]);
    } finally {
      setColorsLoaded(true);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  // Couleurs actuellement proposées : celles des variantes actives.
  const selectedColorIds = variants
    .filter((variant) => variant.active && variant.colorId)
    .map((variant) => variant.colorId as string);

  // Un clic sur une couleur de la palette l'ajoute, un second la désactive.
  function handleToggleColor(colorId: string) {
    const variant = variants.find((item) => item.colorId === colorId);
    if (!variant) return handleAddVariant(colorId);
    return handleToggleVariant(variant);
  }

  // Couleur réactivée dans la palette : à proposer aussi sur ce produit.
  function handleSelectColor(colorId: string) {
    const variant = variants.find((item) => item.colorId === colorId);
    if (!variant) return handleAddVariant(colorId);
    if (!variant.active) return handleToggleVariant(variant);
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
      setPhotos(updated.photos);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      e.target.value = "";
      setSaving(false);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/products/${product.id}/photos/${photoId}`, {
        method: "DELETE",
        headers: { ...getClientAuthHeaders() },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      const updated = await res.json();
      setPhotos(updated.photos);
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
        <ProductColorPicker
          colors={colors}
          selectedColorIds={selectedColorIds}
          lockedColorIds={[]}
          apiUrl={apiUrl}
          loaded={colorsLoaded}
          disabled={saving}
          onToggle={(colorId) => void handleToggleColor(colorId)}
          onSelect={(colorId) => void handleSelectColor(colorId)}
          onCreated={handleAddVariant}
          onChanged={loadColors}
        />
        <div className="flex flex-col gap-2 text-sm">
          <span className="form-label">
            Photos ({photos.length}/{MAX_PRODUCT_PHOTOS})
          </span>
          {photos.length > 0 && (
            <ul className="flex flex-nowrap gap-3">
              {photos.map((photo, index) => (
                <li key={photo.id} className="flex flex-col items-center gap-1">
                  <img
                    src={`${apiUrl}${photo.url}`}
                    alt={`Photo ${index + 1}`}
                    className="h-20 w-20 rounded object-cover"
                  />
                  <Button
                    variant="secondary"
                    disabled={saving}
                    aria-label={`Supprimer la photo ${index + 1}`}
                    onClick={() => void handleRemovePhoto(photo.id)}
                  >
                    Supprimer
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_PRODUCT_PHOTOS && (
            <label className="flex flex-col gap-1">
              Ajouter une photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={saving}
                onChange={handleUploadPhoto}
              />
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
