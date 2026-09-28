"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";

// Reflète ALLOWED_TRANSITIONS côté API (campaign-status.ts) — l'API reste
// la seule source de vérité si jamais ça diverge.
const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: "RECENSEMENT",
  RECENSEMENT: "COMMANDES_OUVERTES",
  COMMANDES_OUVERTES: "COMMANDES_FERMEES",
  COMMANDES_FERMEES: "PRODUCTION",
  PRODUCTION: "EXPEDITION",
  EXPEDITION: "TERMINEE",
};

// ANNULEE reste atteignable jusqu'à EXPEDITION inclus (voir campaign-status.ts
// côté API) — une campagne bloquée par des intérêts existants (suppression
// refusée) doit toujours pouvoir être annulée, quel que soit son avancement.
const CANCELLABLE_FROM = [
  "DRAFT",
  "RECENSEMENT",
  "COMMANDES_OUVERTES",
  "COMMANDES_FERMEES",
  "PRODUCTION",
  "EXPEDITION",
];

function StatusActionButton({
  campaignId,
  target,
  label,
  apiUrl,
  danger,
}: {
  campaignId: string;
  target: string;
  label: string;
  apiUrl: string;
  danger?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setConfirmOpen(false);
      router.refresh();
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
          message={`Passer la campagne au statut ${target} ?`}
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

export function CampaignNextStatusButton({
  campaignId,
  currentStatus,
  apiUrl,
}: {
  campaignId: string;
  currentStatus: string;
  apiUrl: string;
}) {
  const next = NEXT_STATUS[currentStatus];
  const cancellable = CANCELLABLE_FROM.includes(currentStatus);

  if (!next && !cancellable) return null;

  return (
    <div className="flex items-center gap-2">
      {next && (
        <StatusActionButton
          campaignId={campaignId}
          target={next}
          label={`Passer à ${next}`}
          apiUrl={apiUrl}
        />
      )}
      {cancellable && (
        <StatusActionButton
          campaignId={campaignId}
          target="ANNULEE"
          label="Annuler"
          apiUrl={apiUrl}
          danger
        />
      )}
    </div>
  );
}
