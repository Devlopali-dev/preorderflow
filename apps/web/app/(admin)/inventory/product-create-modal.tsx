"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Color } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { ColorLabel } from "@/components/color-label";

async function failure(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.message?.toString() ?? `Erreur (${res.status})`);
}

export function ProductCreateModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  // Tant que le SKU n'a pas été modifié à la main, il se propose depuis le nom.
  // Le slug n'est plus saisi : l'API le génère depuis le nom.
  const [skuEdited, setSkuEdited] = useState(false);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [hasVariants, setHasVariants] = useState(false);
  const [colors, setColors] = useState<Color[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La création se fait en plusieurs appels (produit, photo, une variante par
  // couleur). On garde ce qui est déjà fait : un nouvel essai après un échec
  // partiel reprend où il s'est arrêté au lieu de créer un doublon.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [addedColorIds, setAddedColorIds] = useState<string[]>([]);

  // Palette globale (/settings), seulement les couleurs actives.
  useEffect(() => {
    fetch(`${apiUrl}/api/v1/colors`, { headers: { ...getClientAuthHeaders() } })
      .then((res) => (res.ok ? res.json() : []))
      .then((all: Color[]) => setColors(all.filter((color) => color.active)))
      .catch(() => setColors([]));
  }, [apiUrl]);

  function toggleColor(colorId: string) {
    setSelectedColorIds((current) =>
      current.includes(colorId) ? current.filter((id) => id !== colorId) : [...current, colorId],
    );
  }

  async function handleCreate() {
    setError(null);
    if (hasVariants && selectedColorIds.length === 0) {
      setError("Choisissez au moins une couleur, ou décochez « Ce produit a des variantes ».");
      return;
    }

    setSaving(true);
    let productId = createdProductId;
    try {
      if (!productId) {
        const res = await fetch(`${apiUrl}/api/v1/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
          body: JSON.stringify({
            sku,
            name,
            price: Number(price),
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) throw await failure(res);
        productId = (await res.json()).id as string;
        setCreatedProductId(productId);
      }

      if (photo && !photoUploaded) {
        const formData = new FormData();
        formData.append("file", photo);
        const res = await fetch(`${apiUrl}/api/v1/products/${productId}/photo`, {
          method: "POST",
          headers: { ...getClientAuthHeaders() },
          body: formData,
        });
        if (!res.ok) throw await failure(res);
        setPhotoUploaded(true);
      }

      if (hasVariants) {
        for (const colorId of selectedColorIds.filter((id) => !addedColorIds.includes(id))) {
          const res = await fetch(`${apiUrl}/api/v1/products/${productId}/variants`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
            body: JSON.stringify({ colorId }),
          });
          if (!res.ok) throw await failure(res);
          setAddedColorIds((current) => [...current, colorId]);
        }
      }

      onClose();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      if (productId) {
        // Le produit existe déjà : la liste doit le montrer, et un nouvel
        // essai terminera les étapes restantes.
        setError(`Produit créé, mais une étape a échoué : ${message}. Réessayez pour terminer.`);
        router.refresh();
      } else {
        setError(message);
      }
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
            {createdProductId ? "Fermer" : "Annuler"}
          </Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>
            {createdProductId ? "Réessayer" : "Créer"}
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
            disabled={Boolean(createdProductId)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              if (!skuEdited) setSku(slugify(e.target.value).toUpperCase());
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          SKU
          <Input
            placeholder="SKU"
            value={sku}
            disabled={Boolean(createdProductId)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSkuEdited(true);
              setSku(e.target.value);
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
            disabled={Boolean(createdProductId)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optionnel)
          <Input
            placeholder="Description"
            value={description}
            disabled={Boolean(createdProductId)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Photo (optionnel)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={photoUploaded}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setHasVariants(e.target.checked)}
          />
          Ce produit a des variantes (couleurs)
        </label>
        {hasVariants && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1">Couleurs proposées</legend>
            {colors.length === 0 ? (
              <p className="text-xs opacity-60">
                Aucune couleur dans la palette : créez-en dans les paramètres.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {colors.map((color) => (
                  <label key={color.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedColorIds.includes(color.id)}
                      disabled={addedColorIds.includes(color.id)}
                      onChange={() => toggleColor(color.id)}
                    />
                    <ColorLabel name={color.name} hex={color.hex} />
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
