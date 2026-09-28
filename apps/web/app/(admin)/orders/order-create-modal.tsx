"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

export function OrderCreateModal({
  apiUrl,
  products,
  onClose,
}: {
  apiUrl: string;
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [address1, setAddress1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          customerEmail,
          customerFirstName,
          customerLastName,
          items: [{ productId, quantity: Number(quantity) }],
          shippingAddress: {
            firstName: customerFirstName,
            lastName: customerLastName,
            address1,
            postalCode,
            city,
            country,
          },
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
      title="Nouvelle commande"
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
          placeholder="Email du client"
          type="email"
          value={customerEmail}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value)}
        />
        <Input
          placeholder="Prénom"
          value={customerFirstName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerFirstName(e.target.value)}
        />
        <Input
          placeholder="Nom"
          value={customerLastName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerLastName(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="select flex-1"
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
            className="w-20"
            value={quantity}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
          />
        </div>
        <Input
          placeholder="Adresse"
          value={address1}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="Code postal"
            value={postalCode}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)}
          />
          <Input
            placeholder="Ville"
            value={city}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          />
          <Input
            placeholder="Pays"
            value={country}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
