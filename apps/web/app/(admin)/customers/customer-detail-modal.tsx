"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@preorderflow/ui";
import type { CustomerDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { GdprActions } from "./[id]/gdpr-actions";

export function CustomerDetailModal({
  customerId,
  apiUrl,
  onClose,
}: {
  customerId: string;
  apiUrl: string;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/api/v1/customers/${customerId}`, { headers: getClientAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setCustomer(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur inconnue");
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, customerId]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={customer ? `${customer.firstName} ${customer.lastName}` : "Client"}
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!customer && !error && <p className="text-sm opacity-70">Chargement…</p>}
      {customer && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="opacity-70">
            {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
          </p>

          <div>
            <h3 className="mb-1 font-medium">Adresse</h3>
            {customer.addresses.length === 0 && (
              <p className="opacity-60">Aucune adresse enregistrée</p>
            )}
            {customer.addresses.map((address) => (
              <p key={address.id}>
                {address.address1}, {address.postalCode} {address.city} ({address.country})
              </p>
            ))}
          </div>

          <div>
            <h3 className="mb-1 font-medium">Commandes</h3>
            <ul>
              {customer.orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/orders/${order.id}`} className="underline">
                    #{order.number}
                  </Link>{" "}
                  — {order.status} — {order.total} {order.currency}
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
