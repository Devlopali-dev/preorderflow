"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Color } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { COLOR_PRESETS } from "@/lib/color-presets";
import { ColorLabel } from "@/components/color-label";
import { ConfirmModal } from "@/components/confirm-modal";

// Palette globale, gérée depuis les modales de produit (création et édition).
// Une couleur se supprime tant qu'aucun produit ne l'utilise ; sinon on la
// désactive (elle reste listée, marquée inactive). `onChanged` prévient la
// modale pour qu'elle recharge la liste des couleurs.
export function ColorsManager({
  colors,
  apiUrl,
  onChanged,
}: {
  colors: Color[];
  apiUrl: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const [toDelete, setToDelete] = useState<Color | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingNames = new Set(colors.map((color) => color.name.toLowerCase()));

  async function request(url: string, method: "POST" | "PATCH" | "DELETE", body?: object) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...getClientAuthHeaders(),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      onChanged();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    const created = await request(`${apiUrl}/api/v1/colors`, "POST", { name, hex });
    if (created) setName("");
  }

  async function handleDelete() {
    if (!toDelete) return;
    const deleted = await request(`${apiUrl}/api/v1/colors/${toDelete.id}`, "DELETE");
    if (deleted) setToDelete(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded border p-3 text-sm">
      {colors.length === 0 ? (
        <p className="opacity-60">Aucune couleur. Ajoutez-en pour proposer des variantes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {colors.map((color) => {
            const usedBy = color._count?.variants ?? 0;
            return (
              <li key={color.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ColorLabel name={color.name} hex={color.hex} inactive={!color.active} />
                  <span className="opacity-60">{color.hex}</span>
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={() =>
                      request(`${apiUrl}/api/v1/colors/${color.id}`, "PATCH", {
                        active: !color.active,
                      })
                    }
                  >
                    {color.active ? "Désactiver" : "Activer"}
                  </Button>
                  <span
                    title={
                      usedBy > 0
                        ? `Utilisée par ${usedBy} variante(s) : désactivez-la plutôt que de la supprimer`
                        : undefined
                    }
                  >
                    <Button
                      variant="danger"
                      disabled={saving || usedBy > 0}
                      aria-label={`Supprimer la couleur ${color.name}`}
                      onClick={() => setToDelete(color)}
                    >
                      Supprimer
                    </Button>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <span>Palette de base</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Palette de base">
          {COLOR_PRESETS.map((preset) => {
            const taken = existingNames.has(preset.name.toLowerCase());
            const selected = name === preset.name && hex === preset.hex;
            return (
              <button
                key={preset.name}
                type="button"
                disabled={taken}
                aria-pressed={selected}
                title={taken ? "Déjà dans la palette" : `Utiliser ${preset.name}`}
                onClick={() => {
                  setName(preset.name);
                  setHex(preset.hex);
                }}
                className={`flex items-center gap-2 rounded border px-2 py-1 ${
                  selected ? "font-medium" : ""
                } ${taken ? "opacity-40" : ""}`}
              >
                <ColorLabel name={preset.name} hex={preset.hex} size="sm" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          Nouvelle couleur
          <Input
            placeholder="Nom (ex : Rouge)"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Pastille
          <input
            type="color"
            aria-label="Couleur de la pastille"
            className="h-10 w-14 cursor-pointer rounded border"
            value={hex}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setHex(e.target.value)}
          />
        </label>
        <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={handleCreate}>
          Ajouter
        </Button>
      </div>
      {error && <p className="text-red-600">{error}</p>}

      {toDelete && (
        <ConfirmModal
          title="Supprimer la couleur"
          message={`Supprimer définitivement la couleur « ${toDelete.name} » ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          danger
          loading={saving}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
