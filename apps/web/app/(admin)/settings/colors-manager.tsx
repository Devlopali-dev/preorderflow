"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Color } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

// Palette globale : les couleurs ne sont jamais supprimées (une variante de
// produit peut y faire référence), seulement désactivées.
export function ColorsManager({ colors, apiUrl }: { colors: Color[]; apiUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(url: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
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

  return (
    <div className="card card-body flex flex-col gap-3 text-sm">
      {colors.length === 0 ? (
        <p className="opacity-60">Aucune couleur. Ajoutez-en pour proposer des variantes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {colors.map((color) => (
            <li key={color.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 rounded-full border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
                <span className="opacity-60">{color.hex}</span>
                {!color.active && <span className="badge badge-default">inactive</span>}
              </span>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  request(`${apiUrl}/api/v1/colors/${color.id}`, "PATCH", { active: !color.active })
                }
              >
                {color.active ? "Désactiver" : "Activer"}
              </Button>
            </li>
          ))}
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
    </div>
  );
}
