"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Settings } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function ShippingSettingsForm({ settings, apiUrl }: { settings: Settings; apiUrl: string }) {
  const router = useRouter();
  const [packagingWeightGrams, setPackagingWeightGrams] = useState(
    String(settings.shipping.packagingWeightGrams),
  );
  const [freeThreshold, setFreeThreshold] = useState(
    settings.shipping.freeThreshold === null ? "" : String(settings.shipping.freeThreshold),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Récupère les tarifs La Poste / Colissimo auprès de data.laposte.fr ; rien n'est modifié si
  // l'API est injoignable ou renvoie un barème incohérent.
  async function handleSyncTariffs() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings/shipping/sync-tariffs`, {
        method: "POST",
        headers: getClientAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setSyncMessage("Tarifs La Poste mis à jour.");
      router.refresh();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          packagingWeightGrams: Number(packagingWeightGrams || 0),
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
      <p className="opacity-70">
        Les frais suivent le barème 2026 du transporteur choisi par le client, par tranche de poids
        : La Poste (Lettre Verte, Lettre Verte Suivie, Colissimo) et Mondial Relay (Point Relais,
        domicile).
      </p>
      <label className="flex flex-col gap-1">
        Poids de l'enveloppe et du calage (g, ajouté au poids des articles)
        <Input
          type="number"
          min={0}
          step="1"
          value={packagingWeightGrams}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPackagingWeightGrams(e.target.value)}
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
      <div className="flex flex-col gap-2 border-t pt-3">
        <p>
          Tarifs La Poste (lettres et Colissimo) :{" "}
          {settings.shipping.tariffsSyncedAt
            ? `synchronisés le ${new Date(settings.shipping.tariffsSyncedAt).toLocaleString("fr-FR")}`
            : "barème par défaut du code, jamais synchronisé"}
          . Source : API data.laposte.fr (tarifs entreprises, Colissimo converti en TTC). Mondial
          Relay n'a pas d'API : son barème est dans le code.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" loading={syncing} onClick={handleSyncTariffs}>
            Mettre à jour les tarifs La Poste
          </Button>
          {syncMessage && <span className="text-green-600">{syncMessage}</span>}
        </div>
        {syncError && <p className="text-red-600">{syncError}</p>}
      </div>
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
