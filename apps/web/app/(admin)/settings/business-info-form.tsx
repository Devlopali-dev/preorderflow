"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Settings } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function BusinessInfoForm({ settings, apiUrl }: { settings: Settings; apiUrl: string }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(settings.businessName ?? "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          businessName: businessName || undefined,
          contactEmail: contactEmail || undefined,
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
      <label className="flex flex-col gap-1">
        Nom
        <Input
          placeholder="Nom de l'atelier / de la boutique"
          value={businessName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBusinessName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        Email de contact
        <Input
          type="email"
          placeholder="contact@exemple.com"
          value={contactEmail}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
        />
      </label>
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
