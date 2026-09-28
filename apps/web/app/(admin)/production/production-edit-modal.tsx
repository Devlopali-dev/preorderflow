"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { ProductionBatchSummary } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function ProductionEditModal({
  batch,
  apiUrl,
  onClose,
}: {
  batch: ProductionBatchSummary;
  apiUrl: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const editablePlanned = batch.status === "PLANNED";
  const canReportProduction = batch.status === "IN_PROGRESS" || batch.status === "PARTIALLY_COMPLETED";
  const [reference, setReference] = useState(batch.reference);
  const [plannedQuantities, setPlannedQuantities] = useState<Record<string, string>>(
    Object.fromEntries(batch.items.map((item) => [item.id, String(item.quantityPlanned)])),
  );
  const [producedQuantities, setProducedQuantities] = useState<Record<string, string>>(
    Object.fromEntries(batch.items.map((item) => [item.id, String(item.quantityProduced)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePlanned() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          reference,
          items: batch.items.map((item) => ({
            productionItemId: item.id,
            quantityPlanned: Number(plannedQuantities[item.id]),
          })),
        }),
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

  async function handleStart() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batch.id}/start`, {
        method: "POST",
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

  async function handleReportProduction() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batch.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          items: batch.items.map((item) => ({
            productionItemId: item.id,
            quantityProduced: Number(producedQuantities[item.id]),
          })),
        }),
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
      title={`Production — ${batch.reference}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {editablePlanned && (
            <>
              <Button variant="secondary" loading={saving} onClick={handleStart}>
                Démarrer
              </Button>
              <Button variant="primary" loading={saving} onClick={handleSavePlanned}>
                Enregistrer
              </Button>
            </>
          )}
          {canReportProduction && (
            <Button variant="primary" loading={saving} onClick={handleReportProduction}>
              Enregistrer la production
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!editablePlanned && !canReportProduction && (
          <p className="text-sm opacity-70">Lot en statut {batch.status} — plus d'action disponible.</p>
        )}

        {editablePlanned && (
          <>
            <Input
              placeholder="Référence"
              value={reference}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
            />
            {batch.items.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-2 text-sm">
                {item.product.name} (prévu)
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={plannedQuantities[item.id]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPlannedQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </>
        )}

        {canReportProduction && (
          <>
            <p className="text-sm opacity-70">Quantité fabriquée à ce jour, par produit :</p>
            {batch.items.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-2 text-sm">
                {item.product.name} (prévu {item.quantityPlanned})
                <Input
                  type="number"
                  min={item.quantityProduced}
                  max={item.quantityPlanned}
                  className="w-24"
                  value={producedQuantities[item.id]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setProducedQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </>
        )}

        {!editablePlanned && !canReportProduction && (
          <ul className="text-sm">
            {batch.items.map((item) => (
              <li key={item.id}>
                {item.product.name} : {item.quantityProduced} / {item.quantityPlanned}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
