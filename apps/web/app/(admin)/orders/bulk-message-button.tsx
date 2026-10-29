"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { OrderSummary } from "@/lib/api";
import { ConfirmModal } from "@/components/confirm-modal";
import { getClientAuthHeaders } from "@/lib/auth";
import { orderStatusLabel } from "@/lib/order-status-labels";

// Statuts proposés d'office : brouillons, annulées et remboursées ne sont pas
// des clients à informer (elles restent sélectionnables une à une).
const DEFAULT_EXCLUDED = ["DRAFT", "CANCELLED", "REFUNDED"];

interface SendResult {
  recipients: number;
  sent: number;
  failed: number;
  ccApplied: boolean;
}

export function BulkMessageButton({ apiUrl, orders }: { apiUrl: string; orders: OrderSummary[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={orders.length === 0}>
        Envoyer un message groupé
      </Button>
      {open && <BulkMessageModal apiUrl={apiUrl} orders={orders} onClose={() => setOpen(false)} />}
    </>
  );
}

function BulkMessageModal({
  apiUrl,
  orders,
  onClose,
}: {
  apiUrl: string;
  orders: OrderSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<string, OrderSummary[]>();
    for (const order of orders) map.set(order.status, [...(map.get(order.status) ?? []), order]);
    return [...map.entries()];
  }, [orders]);

  // Plusieurs commandes d'un même client = un seul mail (dédup côté API aussi).
  const recipientCount = useMemo(
    () =>
      new Set(
        orders.filter((o) => selected.has(o.id)).map((o) => o.customer.email.trim().toLowerCase()),
      ).size,
    [orders, selected],
  );

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStatus(group: OrderSummary[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = group.every((o) => next.has(o.id));
      for (const o of group) {
        if (allSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  const canSend = recipientCount > 0 && subject.trim() !== "" && message.trim() !== "";
  const includesExcluded = orders.some(
    (o) => selected.has(o.id) && DEFAULT_EXCLUDED.includes(o.status),
  );

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/orders/bulk-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          orderIds: [...selected],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        throw new Error(detail ?? `Erreur (${res.status})`);
      }
      setResult((await res.json()) as SendResult);
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Message groupé envoyé"
        footer={<Button onClick={onClose}>Fermer</Button>}
      >
        <p className="text-sm">
          {result.sent} message{result.sent > 1 ? "s" : ""} envoyé{result.sent > 1 ? "s" : ""} sur{" "}
          {result.recipients}.
          {result.failed > 0 && ` ${result.failed} échec${result.failed > 1 ? "s" : ""}.`}
          {!result.ccApplied &&
            " Aucune copie carbone : renseignez l'adresse de contact dans les paramètres."}
        </p>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="lg"
        title="Envoyer un message groupé"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!canSend} onClick={() => setConfirming(true)}>
              Envoyer à {recipientCount} client{recipientCount > 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Destinataires</p>
            <div className="flex flex-col gap-2">
              {byStatus.map(([status, group]) => {
                const count = group.filter((o) => selected.has(o.id)).length;
                return (
                  <details
                    key={status}
                    className="card card-body"
                    open={count > 0 && count < group.length}
                  >
                    <summary className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Toute la catégorie ${orderStatusLabel(status)}`}
                        checked={count === group.length}
                        ref={(el) => {
                          if (el) el.indeterminate = count > 0 && count < group.length;
                        }}
                        onChange={() => toggleStatus(group)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="font-medium">{orderStatusLabel(status)}</span>
                      <span className="table-muted">
                        {count}/{group.length}
                      </span>
                    </summary>
                    <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {group.map((order) => (
                        <li key={order.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.has(order.id)}
                              onChange={() => toggleOrder(order.id)}
                            />
                            <span>{order.number}</span>
                            <span className="table-muted">
                              {order.customer.firstName} {order.customer.lastName}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
            <p className="card-subtitle">
              {recipientCount} client{recipientCount > 1 ? "s" : ""} (doublons fusionnés). Copie
              carbone envoyée à l&apos;adresse de contact des paramètres.
            </p>
            {includesExcluded && (
              <p className="text-xs">
                La sélection inclut des commandes en brouillon, annulées ou remboursées.
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Objet
            <Input
              value={subject}
              maxLength={200}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
              placeholder="Objet du message"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Message
            <textarea
              className="input"
              rows={8}
              maxLength={10000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message..."
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
      {confirming && (
        <ConfirmModal
          title="Confirmer l'envoi"
          message={`Envoyer « ${subject.trim()} » à ${recipientCount} client${recipientCount > 1 ? "s" : ""} ? L'envoi est définitif.`}
          confirmLabel="Envoyer"
          loading={sending}
          onConfirm={handleSend}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
