"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@preorderflow/ui";
import type { CustomerDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { GdprActions } from "./[id]/gdpr-actions";
import {
  ADDRESS_TYPE_LABEL,
  CustomerForm,
  customerToFormValue,
  toCustomerPayload,
  type CustomerFormValue,
} from "./customer-form";
import { orderStatusLabel } from "@/lib/order-status-labels";

// Les erreurs de validation de l'API arrivent en liste de messages.
function messageOf(body: { message?: string | string[] } | null, status: number): string {
  const message = body?.message;
  if (Array.isArray(message)) return message.join(" ; ");
  return message ?? `Erreur (${status})`;
}

// Un client anonymisé (RGPD) n'a plus de données personnelles à modifier.
function isAnonymized(customer: CustomerDetail): boolean {
  return customer.email.endsWith("@anonymise.invalid");
}

export function CustomerDetailModal({
  customerId,
  apiUrl,
  onClose,
}: {
  customerId: string;
  apiUrl: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CustomerFormValue | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${customerId}`, {
        headers: getClientAuthHeaders(),
      });
      if (!res.ok) throw new Error(messageOf(await res.json().catch(() => null), res.status));
      setCustomer(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, [apiUrl, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing() {
    if (!customer) return;
    setForm(customerToFormValue(customer));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(toCustomerPayload(form)),
      });
      if (!res.ok) throw new Error(messageOf(await res.json().catch(() => null), res.status));
      await load();
      setEditing(false);
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
      title={customer ? `${customer.firstName} ${customer.lastName}` : "Client"}
      size="lg"
      footer={
        customer &&
        (editing ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            {!isAnonymized(customer) && (
              <Button variant="primary" onClick={startEditing}>
                Modifier
              </Button>
            )}
          </>
        ))
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!customer && !error && <p className="text-sm opacity-70">Chargement…</p>}
      {customer && editing && form && <CustomerForm value={form} onChange={setForm} />}
      {customer && !editing && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="opacity-70">
            {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
          </p>

          <div>
            <h3 className="mb-1 font-medium">Adresses</h3>
            {customer.addresses.length === 0 && (
              <p className="opacity-60">Aucune adresse enregistrée</p>
            )}
            <ul className="flex flex-col gap-2">
              {customer.addresses.map((address) => (
                <li key={address.id}>
                  <span className="badge badge-default mr-2">
                    {ADDRESS_TYPE_LABEL[address.type]}
                  </span>
                  {address.firstName} {address.lastName}
                  {address.company ? ` — ${address.company}` : ""}
                  <br />
                  {address.address1}
                  {address.address2 ? `, ${address.address2}` : ""}, {address.postalCode}{" "}
                  {address.city} ({address.country}){address.phone ? ` · ${address.phone}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Commandes</h3>
            <ul>
              {customer.orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/orders/${order.id}`} className="underline">
                    #{order.number}
                  </Link>{" "}
                  — {orderStatusLabel(order.status)} — {order.total} {order.currency}
                </li>
              ))}
              {customer.orders.length === 0 && <li className="opacity-60">Aucune commande</li>}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-medium">RGPD</h3>
            <GdprActions customerId={customer.id} apiUrl={apiUrl} />
          </div>
        </div>
      )}
    </Modal>
  );
}
