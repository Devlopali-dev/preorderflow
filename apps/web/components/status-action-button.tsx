"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";

// Bouton générique de transition de statut (PATCH {apiUrl}/api/v1/{statusEndpoint}
// avec { status: target }) — l'API reste la seule source de vérité sur les
// transitions valides, ce composant ne fait qu'exposer un raccourci pour l'une
// d'entre elles avec confirmation.
export function StatusActionButton({
  apiUrl,
  statusEndpoint,
  target,
  label,
  targetLabel,
  danger,
  onChanged,
}: {
  apiUrl: string;
  statusEndpoint: string;
  target: string;
  label: string;
  // Statut cible tel qu'affiché dans la confirmation (par défaut, son code).
  targetLabel?: string;
  danger?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/${statusEndpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setConfirmOpen(false);
      router.refresh();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant={danger ? "danger" : "secondary"} onClick={() => setConfirmOpen(true)}>
        {label}
      </Button>
      {confirmOpen && (
        <ConfirmModal
          title="Changer le statut"
          message={`Passer au statut ${targetLabel ?? target} ?`}
          confirmLabel="Confirmer"
          danger={danger}
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
}
