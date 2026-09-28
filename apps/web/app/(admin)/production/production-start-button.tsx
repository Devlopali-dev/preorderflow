"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClientAuthHeaders } from "@/lib/auth";

export function ProductionStartButton({ batchId, apiUrl }: { batchId: string; apiUrl: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches/${batchId}/start`, {
        method: "POST",
        headers: { ...getClientAuthHeaders() },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title="Démarrer la production"
        aria-label="Démarrer la production"
        disabled={saving}
        onClick={handleStart}
        className="inline-flex h-8 w-8 items-center justify-center rounded"
        style={{ color: "var(--color-primary)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
}
