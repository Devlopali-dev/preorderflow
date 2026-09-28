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
  const editable = batch.status === "PLANNED";
  const [reference, setReference] = useState(batch.reference);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(batch.items.map((item) => [item.id, String(item.quantityPlanned)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
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
            quantityPlanned: Number(quantities[item.id]),
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
          {editable && (
            <>
              <Button variant="secondary" loading={saving} onClick={handleStart}>
                Démarrer
              </Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                Enregistrer
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!editable && (
          <p className="text-sm opacity-70">
            Lot en statut {batch.status} — les infos ne sont modifiables que pendant PLANNED. La
            quantité fabriquée se déclare directement dans la liste (boutons +1 / +10).
          </p>
        )}

        {editable ? (
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
                  value={quantities[item.id]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </>
        ) : (
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
