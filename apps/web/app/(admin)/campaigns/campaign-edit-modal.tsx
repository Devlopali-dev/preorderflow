"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Campaign } from "@/lib/api";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";
import { isArchivedCampaign } from "@/lib/campaign-status";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CampaignEditModal({
  campaign,
  apiUrl,
  isAdmin,
  onClose,
}: {
  campaign: Campaign;
  apiUrl: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [indicativePrice, setIndicativePrice] = useState(String(campaign.indicativePrice));
  const [startDate, setStartDate] = useState(toDateInputValue(campaign.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(campaign.endDate));
  const [media, setMedia] = useState(campaign.media ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Une campagne archivée (terminée ou annulée) est en lecture seule : on la
  // réactive ou on la supprime, on ne la modifie pas.
  const readOnly = isArchivedCampaign(campaign.status);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          name,
          indicativePrice: Number(indicativePrice),
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
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

  async function handleReactivate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ status: "DRAFT" }),
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

  async function handleUploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}/photo`, {
        method: "POST",
        headers: { ...getClientAuthHeaders() },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      const updated = await res.json();
      setMedia(updated.media ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadDocument(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}/document`, {
        method: "POST",
        headers: { ...getClientAuthHeaders() },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      const updated = await res.json();
      setMedia(updated.media ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}/media/${mediaId}`, {
        method: "DELETE",
        headers: { ...getClientAuthHeaders() },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      const updated = await res.json();
      setMedia(updated.media ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}`, {
        method: "DELETE",
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
      title={readOnly ? "Campagne archivée (lecture seule)" : "Paramétrer la campagne"}
      size="lg"
      footer={
        readOnly ? (
          <>
            {isAdmin && (
              <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
                Supprimer définitivement
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="primary" loading={saving} onClick={handleReactivate}>
              Réactiver
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
              Supprimer
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {readOnly && (
          <p className="text-sm opacity-70">
            Cette campagne est archivée ({campaign.status}). Réactivez-la pour la modifier : elle
            repart en brouillon.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={name}
            disabled={readOnly}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prix indicatif
          <Input
            type="number"
            step="0.01"
            placeholder="Prix indicatif"
            value={indicativePrice}
            disabled={readOnly}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setIndicativePrice(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Début
          <Input
            type="date"
            value={startDate}
            disabled={readOnly}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Fin (deadline)
          <Input
            type="date"
            value={endDate}
            disabled={readOnly}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <span className="form-label">Aperçus ({media.length}/5)</span>
          {media.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {media.map((item) => (
                <div key={item.id} className="relative overflow-hidden rounded">
                  {item.type === "DOCUMENT" ? (
                    <button
                      type="button"
                      onClick={() => setPreviewPdfUrl(`${apiUrl}${item.url}`)}
                      className={
                        item.thumbnailUrl
                          ? "block w-full overflow-hidden"
                          : "flex aspect-[3/4] w-full items-center justify-center bg-bg-subtle p-2 text-center text-xs"
                      }
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={`${apiUrl}${item.thumbnailUrl}`}
                          alt="Aperçu du document PDF"
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : (
                        "PDF"
                      )}
                    </button>
                  ) : (
                    <img
                      src={`${apiUrl}${item.url}`}
                      alt=""
                      className="aspect-[3/4] w-full object-cover"
                    />
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label="Supprimer l'aperçu"
                      onClick={() => handleDeleteMedia(item.id)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-xs text-white hover:bg-neutral-900"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span className="form-label">Ajouter une image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleUploadPhoto}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="form-label">Ajouter un PDF</span>
                <input type="file" accept="application/pdf" onChange={handleUploadDocument} />
              </label>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {confirmDeleteOpen && (
        <ConfirmModal
          title={readOnly ? "Supprimer définitivement la campagne" : "Supprimer la campagne"}
          message={
            readOnly
              ? `Supprimer définitivement la campagne "${campaign.name}" ? Ses demandes de recensement et ses fichiers seront supprimés aussi. Cette action est irréversible.`
              : `Supprimer la campagne "${campaign.name}" ? Cette action est irréversible.`
          }
          confirmLabel={readOnly ? "Supprimer définitivement" : "Supprimer"}
          danger
          loading={saving}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}
      {previewPdfUrl && (
        <Modal isOpen onClose={() => setPreviewPdfUrl(null)} title="Aperçu du PDF" size="xl">
          <iframe src={previewPdfUrl} title="Aperçu du PDF" className="h-[75vh] w-full" />
        </Modal>
      )}
    </Modal>
  );
}
