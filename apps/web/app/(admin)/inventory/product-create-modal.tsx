"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Color } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { MAX_PRODUCT_PHOTOS } from "@/lib/product-photos";
import { slugify } from "@/lib/slugify";
import { ColorLabel } from "@/components/color-label";
import { ColorsManager } from "@/components/colors-manager";

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [colors, setColors] = useState<Color[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La création se fait en plusieurs appels (produit, photo, une variante par
  // couleur). On garde ce qui est déjà fait : un nouvel essai après un échec
  // partiel reprend où il s'est arrêté au lieu de créer un doublon.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState(0);
  const [addedColorIds, setAddedColorIds] = useState<string[]>([]);

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Palette globale (toutes les couleurs : le gestionnaire voit aussi les
  // inactives), rechargée quand on la modifie ici. Une couleur cochée puis
  // désactivée ou supprimée sort de la sélection ; une couleur qu'on vient de
  // créer est sélectionnée d'office (on l'a ajoutée pour ce produit : pas
  // besoin de la cocher ensuite).
  const knownColorIds = useRef<Set<string> | null>(null);
  const loadColors = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/colors`, {
        headers: { ...getClientAuthHeaders() },
      });
      const all: Color[] = res.ok ? await res.json() : [];
      setColors(all);

      // Le premier chargement ne sélectionne rien : seules les couleurs
      // apparues depuis comptent comme « créées ici ».
      const known = knownColorIds.current;
      const created = known
        ? all.filter((color) => color.active && !known.has(color.id)).map((color) => color.id)
        : [];
      knownColorIds.current = new Set(all.map((color) => color.id));

      setSelectedColorIds((current) => [
        ...current.filter((id) => all.some((color) => color.id === id && color.active)),
        ...created.filter((id) => !current.includes(id)),
      ]);
    } catch {
      setColors([]);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  const activeColors = colors.filter((color) => color.active);

  function toggleColor(colorId: string) {
    setSelectedColorIds((current) =>
      current.includes(colorId) ? current.filter((id) => id !== colorId) : [...current, colorId],
    );
  }

  // Au plus 3 photos : les fichiers en trop sont écartés, avec un message.
  function handlePickPhotos(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PRODUCT_PHOTOS - photos.length;
    setPhotos((current) => [...current, ...picked.slice(0, room)]);
    setError(
      picked.length > room
        ? `Un produit accepte ${MAX_PRODUCT_PHOTOS} photos au maximum : les fichiers en trop ont été écartés.`
        : null,
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

      for (let index = uploadedPhotos; index < photos.length; index += 1) {
        const formData = new FormData();
        formData.append("file", photos[index]!);
        const res = await fetch(`${apiUrl}/api/v1/products/${productId}/photo`, {
          method: "POST",
          headers: { ...getClientAuthHeaders() },
          body: formData,
        });
        if (!res.ok) throw await failure(res);
        setUploadedPhotos(index + 1);
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
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Photos (optionnel, {photos.length}/{MAX_PRODUCT_PHOTOS})
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={Boolean(createdProductId) || photos.length >= MAX_PRODUCT_PHOTOS}
              onChange={handlePickPhotos}
            />
          </label>
          {photos.length > 0 && (
            <ul className="flex flex-col gap-1">
              {photos.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{file.name}</span>
                  <Button
                    variant="secondary"
                    disabled={index < uploadedPhotos}
                    aria-label={`Retirer la photo ${file.name}`}
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  >
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
            {activeColors.length === 0 ? (
              <p className="text-xs opacity-60">
                Aucune couleur active : ajoutez-en dans la palette ci-dessous.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {activeColors.map((color) => (
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
            <Button
              variant="secondary"
              aria-expanded={paletteOpen}
              onClick={() => setPaletteOpen((open) => !open)}
            >
              {paletteOpen ? "Masquer la palette de couleurs" : "Gérer la palette de couleurs"}
            </Button>
            {paletteOpen && (
              <ColorsManager colors={colors} apiUrl={apiUrl} onChanged={loadColors} />
            )}
          </fieldset>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
