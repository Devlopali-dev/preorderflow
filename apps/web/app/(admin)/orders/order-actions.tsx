"use client";

import { StatusActionButton } from "@/components/status-action-button";
import { orderStatusActionLabel, orderStatusLabel } from "@/lib/order-status-labels";

// Reflète ALLOWED_TRANSITIONS côté API (order-status.ts) — l'API reste la
// seule source de vérité si jamais ça diverge.
//
// Seules les étapes propres à la commande figurent ici. Les autres ont leur
// propre écran et n'ont pas de bouton en double :
// - « payée » : confirmer le paiement (panneau Paiement), qui renseigne aussi
//   `paymentStatus` — une commande passée à « payée » à la main resterait non livrable ;
// - « expédiée » et « livrée » : créer puis suivre l'expédition (panneau Préparation).
const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: "PENDING_PAYMENT",
  PAID: "PROCESSING",
  PROCESSING: "READY_TO_SHIP",
};

const CANCELLABLE_FROM = ["DRAFT", "PENDING_PAYMENT"];
// Une commande livrée est en lecture seule : plus de remboursement.
const REFUNDABLE_FROM = ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED"];

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
          label={orderStatusActionLabel(next)}
          targetLabel={orderStatusLabel(next)}
          onChanged={onChanged}
        />
      )}
      {cancellable && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={`orders/${orderId}/status`}
          target="CANCELLED"
          label={orderStatusActionLabel("CANCELLED")}
          targetLabel={orderStatusLabel("CANCELLED")}
          danger
          onChanged={onChanged}
        />
      )}
      {refundable && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={`orders/${orderId}/status`}
          target="REFUNDED"
          label={orderStatusActionLabel("REFUNDED")}
          targetLabel={orderStatusLabel("REFUNDED")}
          danger
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
