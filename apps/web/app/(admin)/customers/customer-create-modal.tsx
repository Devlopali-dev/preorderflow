"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@preorderflow/ui";
import { getClientAuthHeaders } from "@/lib/auth";
import {
  CustomerForm,
  EMPTY_CUSTOMER,
  toCustomerPayload,
  type CustomerFormValue,
} from "./customer-form";

// Les erreurs de validation de l'API arrivent en liste de messages.
function messageOf(body: { message?: string | string[] } | null, status: number): string {
  const message = body?.message;
  if (Array.isArray(message)) return message.join(" ; ");
  return message ?? `Erreur (${status})`;
}

export function CustomerCreateModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState<CustomerFormValue>(EMPTY_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(toCustomerPayload(value)),
      });
      if (!res.ok) throw new Error(messageOf(await res.json().catch(() => null), res.status));
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
      title="Nouveau client"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>
            Créer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CustomerForm value={value} onChange={setValue} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
