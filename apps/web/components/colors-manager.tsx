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
// La palette de base se pilote en un clic, par bouton à bascule : un bouton
// non enfoncé ajoute la couleur (ou la réactive), un bouton enfoncé la retire.
// Une couleur se supprime tant qu'aucun produit ne l'utilise ; sinon on la
// désactive (elle reste marquée inactive). Les couleurs hors palette de base
// sont listées dessous, avec leurs boutons. `onChanged` prévient la modale
// pour qu'elle recharge la liste des couleurs.
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

  const presetNames = new Set(COLOR_PRESETS.map((preset) => preset.name.toLowerCase()));
  const colorOfPreset = (presetName: string) =>
    colors.find((color) => color.name.toLowerCase() === presetName.toLowerCase());
  const customColors = colors.filter((color) => !presetNames.has(color.name.toLowerCase()));

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

  // Bascule d'une couleur de la palette de base : ajoutée → active → retirée
  // (supprimée si aucun produit ne l'utilise, sinon simplement désactivée).
  async function togglePreset(preset: { name: string; hex: string }) {
    const existing = colorOfPreset(preset.name);
    if (!existing) {
      await request(`${apiUrl}/api/v1/colors`, "POST", { name: preset.name, hex: preset.hex });
    } else if (!existing.active) {
      await request(`${apiUrl}/api/v1/colors/${existing.id}`, "PATCH", { active: true });
    } else if ((existing._count?.variants ?? 0) > 0) {
      await request(`${apiUrl}/api/v1/colors/${existing.id}`, "PATCH", { active: false });
    } else {
      await request(`${apiUrl}/api/v1/colors/${existing.id}`, "DELETE");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const deleted = await request(`${apiUrl}/api/v1/colors/${toDelete.id}`, "DELETE");
    if (deleted) setToDelete(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded border p-3 text-sm">
      <div className="flex flex-col gap-2">
        <span>Palette de base</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Palette de base">
          {COLOR_PRESETS.map((preset) => {
            const existing = colorOfPreset(preset.name);
            const on = Boolean(existing?.active);
            const title = !existing
              ? `Ajouter ${preset.name} à la palette`
              : !existing.active
                ? `Réactiver ${preset.name}`
                : (existing._count?.variants ?? 0) > 0
                  ? `Désactiver ${preset.name} (utilisée par un produit)`
                  : `Retirer ${preset.name} de la palette`;
            return (
              <button
                key={preset.name}
                type="button"
                disabled={saving}
                aria-pressed={on}
                title={title}
                onClick={() => void togglePreset(preset)}
                className={`flex items-center gap-2 rounded border px-2 py-1 ${
                  on ? "font-medium" : "opacity-60"
                }`}
              >
                <ColorLabel name={preset.name} hex={preset.hex} size="sm" />
              </button>
            );
          })}
        </div>
      </div>

      {customColors.length > 0 && (
        <ul className="flex flex-col gap-2">
          {customColors.map((color) => {
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
