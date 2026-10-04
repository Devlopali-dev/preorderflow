"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Settings } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function ShippingSettingsForm({ settings, apiUrl }: { settings: Settings; apiUrl: string }) {
  const router = useRouter();
  const [flatRate, setFlatRate] = useState(String(settings.shipping.flatRate));
  const [freeThreshold, setFreeThreshold] = useState(
    settings.shipping.freeThreshold === null ? "" : String(settings.shipping.freeThreshold),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          shippingFlatRate: Number(flatRate || 0),
          // Champ vide = livraison jamais offerte.
          freeShippingThreshold: freeThreshold === "" ? null : Number(freeThreshold),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-body flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        Forfait de livraison par commande (€)
        <Input
          type="number"
          min={0}
          step="0.01"
          value={flatRate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFlatRate(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        Livraison offerte à partir de (€ HT, vide = jamais)
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="Ex. 50"
          value={freeThreshold}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFreeThreshold(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} onClick={handleSave}>
          Enregistrer
        </Button>
        {success && <span className="text-green-600">Enregistré</span>}
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
