"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import type { ProductionBatchSummary } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

// Un seul champ +1/+10 par lot : n'a de sens que pour un lot mono-produit
// (le cas courant). Un lot multi-produits garde le comptage en lecture
// seule ici — pas de façon non ambiguë de répartir l'incrément.
export function ProductionIncrementButtons({
  batch,
  apiUrl,
}: {
  batch: ProductionBatchSummary;
  apiUrl: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (batch.items.length !== 1) return null;
  if (batch.status !== "IN_PROGRESS" && batch.status !== "PARTIALLY_COMPLETED") return null;
  const item = batch.items[0];
  const atMax = item.quantityProduced >= item.quantityPlanned;

  async function increment(step: number) {
    setSaving(true);
    setError(null);
    try {
      const quantityProduced = Math.min(item.quantityProduced + step, item.quantityPlanned);
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batch.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ items: [{ productionItemId: item.id, quantityProduced }] }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  // Retire 1 unité déclarée produite (erreur de saisie, casse) : l'API ajoute un
  // mouvement de stock négatif, l'historique n'est jamais réécrit.
  async function decrement() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batch.id}/decrement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ productionItemId: item.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        aria-label="Décrémenter de 1"
        disabled={saving || item.quantityProduced <= 0}
        onClick={decrement}
      >
        −1
      </Button>
      <Button variant="secondary" disabled={saving || atMax} onClick={() => increment(1)}>
        +1
      </Button>
      <Button variant="secondary" disabled={saving || atMax} onClick={() => increment(10)}>
        +10
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
