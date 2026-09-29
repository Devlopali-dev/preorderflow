"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { AdminProfile } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function AdminProfileForm({ profile, apiUrl }: { profile: AdminProfile; apiUrl: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ firstName, lastName }),
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          Prénom
          <Input
            value={firstName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Nom
          <Input
            value={lastName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs opacity-70">
        {profile.email} · {profile.role === "ADMIN" ? "Administrateur" : "Opérateur"}
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={saving}
          disabled={!firstName.trim() || !lastName.trim()}
          onClick={handleSave}
        >
          Enregistrer
        </Button>
        {success && <span className="text-green-600">Enregistré</span>}
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
