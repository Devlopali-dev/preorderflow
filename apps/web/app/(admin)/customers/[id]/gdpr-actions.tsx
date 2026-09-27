"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { getClientAuthHeaders } from "@/lib/auth";

export function GdprActions({ customerId, apiUrl }: { customerId: string; apiUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exportedData, setExportedData] = useState<unknown>(null);
  const [loading, setLoading] = useState<"export" | "anonymize" | null>(null);

  async function exportData() {
    setError(null);
    setLoading("export");
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${customerId}/gdpr-export`, {
        method: "POST",
        headers: getClientAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? `Erreur (${res.status})`);
      setExportedData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(null);
    }
  }

  async function anonymize() {
    if (!confirm("Anonymiser ce client ? Cette action est irréversible.")) return;
    setError(null);
    setLoading("anonymize");
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${customerId}/gdpr-anonymize`, {
        method: "POST",
        headers: getClientAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? `Erreur (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={exportData} loading={loading === "export"}>
          Exporter les données (RGPD)
        </Button>
        <Button variant="danger" onClick={anonymize} loading={loading === "anonymize"}>
          Anonymiser
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {typeof exportedData === "object" && exportedData !== null ? (
        <pre className="max-h-80 overflow-auto rounded bg-black/5 p-3 text-xs">
          {JSON.stringify(exportedData, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
