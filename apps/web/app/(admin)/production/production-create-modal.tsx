"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function ProductionCreateModal({
  apiUrl,
  products,
  onClose,
}: {
  apiUrl: string;
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantityPlanned, setQuantityPlanned] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/production/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          reference,
          items: [{ productId, quantityPlanned: Number(quantityPlanned) }],
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

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nouvelle production"
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
        <Input
          placeholder="Référence"
          value={reference}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
        />
        <select
          className="select"
          value={productId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setProductId(e.target.value)}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          placeholder="Quantité prévue"
          value={quantityPlanned}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantityPlanned(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
