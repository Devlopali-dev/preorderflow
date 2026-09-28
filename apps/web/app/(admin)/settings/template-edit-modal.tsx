"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@preorderflow/ui";
import type { NotificationTemplateDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function TemplateEditModal({
  template,
  apiUrl,
  onClose,
}: {
  template: NotificationTemplateDetail;
  apiUrl: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings/templates/${template.template}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ subject, html }),
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

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings/templates/${template.template}`, {
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
      title={`Template — ${template.template}`}
      footer={
        <>
          {template.customized && (
            <Button variant="danger" loading={saving} onClick={handleReset}>
              Réinitialiser
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {template.placeholders.length > 0 && (
          <p className="text-xs opacity-70">
            Variables disponibles :{" "}
            {template.placeholders.map((p) => (
              <code key={p} className="mr-1 rounded bg-black/5 px-1">{`{{${p}}}`}</code>
            ))}
          </p>
        )}
        <label className="flex flex-col gap-1">
          Sujet
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          Corps (HTML)
          <textarea
            className="input"
            rows={8}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
          />
        </label>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
