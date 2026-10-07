"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { StatusActionButton } from "@/components/status-action-button";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";
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
// Remise en main propre : la commande passe directement à « livrée ».
const HAND_DELIVERABLE_FROM = ["PROCESSING", "READY_TO_SHIP"];
// Une commande livrée est en lecture seule : plus de remboursement.
const REFUNDABLE_FROM = ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED"];

// Y a-t-il au moins une action pour ce statut ? Sert à ne pas réserver un pied de
// modale (ou un titre de section) vide pour une commande annulée ou remboursée.
export function hasOrderActions(status: string): boolean {
  return (
    NEXT_STATUS[status] !== undefined ||
    HAND_DELIVERABLE_FROM.includes(status) ||
    CANCELLABLE_FROM.includes(status) ||
    REFUNDABLE_FROM.includes(status)
  );
}

// Bouton « a payé » : confirme le paiement en attente de la commande (POST
// /orders/:id/payments/confirm) depuis la liste, sans avoir l'id du paiement.
function MarkPaidButton({
  apiUrl,
  orderId,
  onChanged,
}: {
  apiUrl: string;
  orderId: string;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/orders/${orderId}/payments/confirm`, {
        method: "POST",
        headers: getClientAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setConfirmOpen(false);
      router.refresh();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        a payé
      </Button>
      {confirmOpen && (
        <ConfirmModal
          title="Confirmer le paiement"
          message="Confirmer que le paiement de cette commande a bien été reçu ?"
          confirmLabel="Confirmer"
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
  );
}

// Bouton « Remise en main propre » : crée l'expédition livrée et passe la commande à « livrée »
// (POST /shipments/hand-delivery), depuis la liste.
function HandDeliveryButton({
  apiUrl,
  orderId,
  onChanged,
}: {
  apiUrl: string;
  orderId: string;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/shipments/hand-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setConfirmOpen(false);
      router.refresh();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        Remise en main propre
      </Button>
      {confirmOpen && (
        <ConfirmModal
          title="Remise en main propre"
          message="Confirmer que la commande a été remise en main propre ? Elle passera à « Livrée »."
          confirmLabel="Confirmer"
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </>
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
      {status === "PENDING_PAYMENT" && (
        <MarkPaidButton apiUrl={apiUrl} orderId={orderId} onChanged={onChanged} />
      )}
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
      {HAND_DELIVERABLE_FROM.includes(status) && (
        <HandDeliveryButton apiUrl={apiUrl} orderId={orderId} onChanged={onChanged} />
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
