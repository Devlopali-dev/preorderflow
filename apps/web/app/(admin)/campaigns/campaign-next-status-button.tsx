"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";

// Reflète ALLOWED_TRANSITIONS côté API (campaign-status.ts) — seule la
// transition "avant" (jamais ANNULEE) ; l'API reste la seule source de
// vérité si jamais ça diverge.
const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: "RECENSEMENT",
  RECENSEMENT: "COMMANDES_OUVERTES",
  COMMANDES_OUVERTES: "COMMANDES_FERMEES",
  COMMANDES_FERMEES: "PRODUCTION",
  PRODUCTION: "EXPEDITION",
  EXPEDITION: "TERMINEE",
};

export function CampaignNextStatusButton({
  campaignId,
  currentStatus,
  apiUrl,
}: {
  campaignId: string;
  currentStatus: string;
  apiUrl: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUS[currentStatus];

  if (!next) return null;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ status: next }),
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
      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        Passer à {next}
      </Button>
      {confirmOpen && (
        <ConfirmModal
          title="Changer le statut"
          message={`Passer la campagne au statut ${next} ?`}
          confirmLabel="Confirmer"
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
}
