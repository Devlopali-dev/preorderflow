"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { OrderDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import { shipmentStatusLabel } from "@/lib/shipment-status-labels";
import { CARRIER_LABELS } from "@/lib/shipping-tariffs";

const NEXT_SHIPMENT_STATUS: Record<string, { label: string; status: string } | undefined> = {
  PENDING: { label: "Marquer comme expédiée", status: "SHIPPED" },
  LABEL_CREATED: { label: "Marquer comme expédiée", status: "SHIPPED" },
  SHIPPED: { label: "Marquer en transit", status: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Marquer livrée", status: "DELIVERED" },
  OUT_FOR_DELIVERY: { label: "Marquer livrée", status: "DELIVERED" },
};

export function FulfillmentPanel({ order, apiUrl }: { order: OrderDetail; apiUrl: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState(
    order.carrier ? CARRIER_LABELS[order.carrier] : "Colissimo",
  );
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  async function createShipment(overrides?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }) {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          orderId: order.id,
          carrier: overrides?.carrier ?? carrier,
          trackingNumber: overrides?.trackingNumber ?? trackingNumber,
          trackingUrl: overrides?.trackingUrl ?? trackingUrl,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  // Remise en main propre : pas de transporteur ni de suivi, la commande passe directement
  // à « livrée » (l'API crée l'expédition déjà livrée, dont le libellé sert de trace).
  async function handleHandDelivery() {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/shipments/hand-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function advanceShipment(status: string) {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/shipments/${order.shipment!.id}/status`, {
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
    <div className="flex flex-col gap-3">
      {order.shipment ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Transporteur : {order.shipment.carrier ?? "—"} · Suivi :{" "}
            {order.shipment.trackingNumber ?? "—"}
          </p>
          {order.shipment.trackingUrl && (
            <a
              href={order.shipment.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Suivre le colis
            </a>
          )}
          <p>Statut expédition : {shipmentStatusLabel(order.shipment.status)}</p>
          {NEXT_SHIPMENT_STATUS[order.shipment.status] && (
            <Button
              variant="secondary"
              loading={isPending}
              onClick={() => advanceShipment(NEXT_SHIPMENT_STATUS[order.shipment!.status]!.status)}
            >
              {NEXT_SHIPMENT_STATUS[order.shipment.status]!.label}
            </Button>
          )}
        </div>
      ) : order.status === "READY_TO_SHIP" ? (
        order.deliveryMethod === "PICKUP" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>Le client a choisi la remise en main propre.</p>
            <Button variant="primary" loading={isPending} onClick={handleHandDelivery}>
              Remise en main propre
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Transporteur"
              value={carrier}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrier(e.target.value)}
            />
            <Input
              placeholder="Numéro de suivi"
              value={trackingNumber}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTrackingNumber(e.target.value)}
            />
            <Input
              placeholder="URL de suivi"
              value={trackingUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTrackingUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="primary" loading={isPending} onClick={() => createShipment()}>
                Créer l'expédition
              </Button>
              <Button variant="secondary" loading={isPending} onClick={handleHandDelivery}>
                Remise en main propre
              </Button>
            </div>
          </div>
        )
      ) : order.status === "PROCESSING" ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="opacity-60">La préparation avance avec le bouton de statut en bas.</p>
          <div>
            <Button variant="secondary" loading={isPending} onClick={handleHandDelivery}>
              Remise en main propre
            </Button>
          </div>
        </div>
      ) : order.status === "PAID" ? (
        <p className="text-sm opacity-60">La préparation avance avec le bouton de statut en bas.</p>
      ) : (
        <p className="text-sm opacity-60">Pas d'action de préparation disponible pour ce statut.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
