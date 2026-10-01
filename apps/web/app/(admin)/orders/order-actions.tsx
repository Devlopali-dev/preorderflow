"use client";

import { StatusActionButton } from "@/components/status-action-button";

// Reflète ALLOWED_TRANSITIONS côté API (order-status.ts) — l'API reste la
// seule source de vérité si jamais ça diverge.
const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: "PENDING_PAYMENT",
  PENDING_PAYMENT: "PAID",
  PAID: "PROCESSING",
  PROCESSING: "READY_TO_SHIP",
  READY_TO_SHIP: "SHIPPED",
  SHIPPED: "DELIVERED",
};

const CANCELLABLE_FROM = ["DRAFT", "PENDING_PAYMENT"];
const REFUNDABLE_FROM = ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

// Y a-t-il au moins une action pour ce statut ? Sert à ne pas réserver un pied de
// modale (ou un titre de section) vide pour une commande annulée ou remboursée.
export function hasOrderActions(status: string): boolean {
  return (
    NEXT_STATUS[status] !== undefined ||
    CANCELLABLE_FROM.includes(status) ||
    REFUNDABLE_FROM.includes(status)
  );
}

export function OrderActions({
  orderId,
  status,
  apiUrl,
  onChanged,
}: {
  orderId: string;
  status: string;
  apiUrl: string;
  onChanged?: () => void;
}) {
  const next = NEXT_STATUS[status];
  const cancellable = CANCELLABLE_FROM.includes(status);
  const refundable = REFUNDABLE_FROM.includes(status);

  if (!hasOrderActions(status)) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      {next && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={`orders/${orderId}/status`}
          target={next}
          label={`Passer à ${next}`}
          onChanged={onChanged}
        />
      )}
      {cancellable && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={`orders/${orderId}/status`}
          target="CANCELLED"
          label="Annuler"
          danger
          onChanged={onChanged}
        />
      )}
      {refundable && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={`orders/${orderId}/status`}
          target="REFUNDED"
          label="Rembourser"
          danger
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
