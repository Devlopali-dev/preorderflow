"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";

type Pending = "reactivate" | "delete" | null;

// Actions sur une campagne archivée (terminée ou annulée) : la réactiver (retour
// en brouillon) ou la supprimer définitivement (ADMIN uniquement, avec ses
// demandes de recensement). L'API reste l'autorité sur les droits.
export function CampaignArchiveActions({
  campaignId,
  campaignName,
  apiUrl,
  isAdmin,
}: {
  campaignId: string;
  campaignName: string;
  apiUrl: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res =
        pending === "delete"
          ? await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}`, {
              method: "DELETE",
              headers: { ...getClientAuthHeaders() },
            })
          : await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
              body: JSON.stringify({ status: "DRAFT" }),
            });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setPending("reactivate")}>
          Réactiver
        </Button>
        {isAdmin && (
          <Button variant="danger" onClick={() => setPending("delete")}>
            Supprimer définitivement
          </Button>
        )}
      </div>
      {pending && (
        <ConfirmModal
          title={pending === "delete" ? "Supprimer définitivement" : "Réactiver la campagne"}
          message={
            pending === "delete"
              ? `Supprimer définitivement la campagne "${campaignName}" ? Ses demandes de recensement et ses fichiers seront supprimés aussi. Cette action est irréversible.`
              : `Réactiver la campagne "${campaignName}" ? Elle repart en brouillon et redevient modifiable.`
          }
          confirmLabel={pending === "delete" ? "Supprimer définitivement" : "Réactiver"}
          danger={pending === "delete"}
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => {
            setPending(null);
            setError(null);
          }}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
}
