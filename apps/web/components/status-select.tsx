"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getClientAuthHeaders } from "@/lib/auth";

// Propose tous les statuts (pas seulement les transitions valides) — l'API
// reste la seule source de vérité sur les transitions autorisées
// (ALLOWED_TRANSITIONS côté NestJS) et renvoie 400 avec un message français
// sinon, affiché ici sans changer le statut affiché.
export function StatusSelect({
  apiUrl,
  statusEndpoint,
  currentStatus,
  options,
}: {
  apiUrl: string;
  statusEndpoint: string;
  currentStatus: string;
  options: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleChange(status: string) {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/${statusEndpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <div>
      <select
        className="select"
        value={currentStatus}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
