"use client";

import { useState, type ChangeEvent } from "react";
import { Button, Input } from "@preorderflow/ui";
import type { Color } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { COLOR_PRESETS } from "@/lib/color-presets";
import { ColorLabel } from "@/components/color-label";

// Choix des couleurs d'un NOUVEAU produit : un clic sur une couleur de la palette
// l'ajoute aux « couleurs proposées », un second clic la retire. Pas de cases à
// cocher. Une couleur absente de la base est créée au premier clic (les variantes
// référencent une couleur de la palette globale), une couleur désactivée est
// réactivée. Supprimer ou désactiver une couleur se fait depuis la modale d'un
// produit existant, pas ici.
export function ProductColorPicker({
  colors,
  selectedColorIds,
  lockedColorIds,
  apiUrl,
  loaded,
  disabled,
  onToggle,
  onSelect,
  onChanged,
}: {
  colors: Color[];
  selectedColorIds: string[];
  // Couleurs déjà ajoutées au produit (reprise après un échec partiel) : figées.
  lockedColorIds: string[];
  apiUrl: string;
  // Liste des couleurs chargée : avant, la palette ne sait pas lesquelles existent déjà.
  loaded: boolean;
  disabled?: boolean;
  onToggle: (colorId: string) => void;
  onSelect: (colorId: string) => void;
  // Recharge la liste des couleurs (les nouvelles couleurs actives sont sélectionnées d'office).
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byName = new Map(colors.map((color) => [color.name.toLowerCase(), color]));
  const presetNames = new Set(COLOR_PRESETS.map((preset) => preset.name.toLowerCase()));
  // Palette : les couleurs de base (déjà créées ou non), puis les autres couleurs actives.
  const palette = [
    ...COLOR_PRESETS.map((preset) => ({
      name: preset.name,
      hex: preset.hex,
      color: byName.get(preset.name.toLowerCase()),
    })),
    ...colors
      .filter((color) => color.active && !presetNames.has(color.name.toLowerCase()))
      .map((color) => ({ name: color.name, hex: color.hex, color })),
  ];
  const selected = colors.filter((color) => selectedColorIds.includes(color.id));

  async function call(url: string, method: "POST" | "PATCH", body: object): Promise<Color | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      return (await res.json()) as Color;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function pick(item: { name: string; hex: string; color?: Color }) {
    const { color } = item;
    if (!color) {
      // Créée puis sélectionnée d'office au rechargement de la liste.
      if (await call(`${apiUrl}/api/v1/colors`, "POST", { name: item.name, hex: item.hex })) {
        await onChanged();
      }
    } else if (!color.active) {
      if (await call(`${apiUrl}/api/v1/colors/${color.id}`, "PATCH", { active: true })) {
        onSelect(color.id);
        await onChanged();
      }
    } else {
      onToggle(color.id);
    }
  }

  async function handleCreate() {
    if (await call(`${apiUrl}/api/v1/colors`, "POST", { name, hex })) {
      setName("");
      await onChanged();
    }
  }

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1">Couleurs proposées</legend>
      {selected.length === 0 ? (
        <p className="text-xs opacity-60">
          Aucune couleur choisie : cliquez sur une couleur de la palette.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Couleurs proposées">
          {selected.map((color) => (
            <li key={color.id} className="rounded border px-2 py-1">
              <ColorLabel name={color.name} hex={color.hex} />
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Masquer la palette de couleurs" : "Gérer la palette de couleurs"}
      </Button>

      {open && (
        <div className="flex flex-col gap-3 rounded border p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Palette de couleurs">
            {palette.map((item) => {
              const on = Boolean(item.color && selectedColorIds.includes(item.color.id));
              const locked = Boolean(item.color && lockedColorIds.includes(item.color.id));
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled={!loaded || busy || disabled || locked}
                  aria-pressed={on}
                  title={on ? `Retirer ${item.name}` : `Ajouter ${item.name}`}
                  onClick={() => void pick(item)}
                  className={`flex items-center gap-2 rounded border px-2 py-1 ${
                    on ? "font-medium" : "opacity-60"
                  }`}
                >
                  <ColorLabel name={item.name} hex={item.hex} size="sm" />
                </button>
              );
            })}
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
            <Button
              variant="primary"
              loading={busy}
              disabled={!name.trim() || disabled}
              onClick={handleCreate}
            >
              Ajouter
            </Button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </fieldset>
  );
}
