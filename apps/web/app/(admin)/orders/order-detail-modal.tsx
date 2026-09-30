"use client";

import { useEffect, useState } from "react";
import { Modal } from "@preorderflow/ui";
import type { OrderDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { variantLabel } from "@/lib/variants";
import { PaymentPanel } from "./[id]/payment-panel";
import { FulfillmentPanel } from "./[id]/fulfillment-panel";
import { OrderActions } from "./order-actions";

export function OrderDetailModal({
  orderId,
  apiUrl,
  onClose,
}: {
  orderId: string;
  apiUrl: string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/api/v1/orders/${orderId}`, { headers: getClientAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur inconnue");
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, orderId, refreshKey]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={order ? `Commande #${order.number}` : "Commande"}
      size="lg"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!order && !error && <p className="text-sm opacity-70">Chargement…</p>}
      {order && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="opacity-70">
            {order.customer.firstName} {order.customer.lastName} — {order.status}
          </p>

          <div>
            <h3 className="mb-1 font-medium">Articles</h3>
            <ul>
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity} × {variantLabel(item.variant.product.name, item.variant.color)} —{" "}
                  {item.unitPrice} €
                </li>
              ))}
            </ul>
            <p className="mt-2 font-medium">Total : {order.total} €</p>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Statut</h3>
            <OrderActions
              orderId={order.id}
              status={order.status}
              apiUrl={apiUrl}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div>
            <h3 className="mb-1 font-medium">Paiement</h3>
            <PaymentPanel order={order} apiUrl={apiUrl} />
          </div>

          <div>
            <h3 className="mb-1 font-medium">Préparation & expédition</h3>
            <FulfillmentPanel order={order} apiUrl={apiUrl} />
          </div>
        </div>
      )}
    </Modal>
  );
}
