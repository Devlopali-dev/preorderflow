"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@preorderflow/ui";
import { PaymentQrCode } from "@/components/payment-qr-code";
import type { OrderDetail } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";
import {
  PAYMENT_PROVIDER_LABEL,
  paymentProviderLabel,
  paymentStatusLabel,
} from "@/lib/payment-labels";

const PROVIDER_OPTIONS = Object.entries(PAYMENT_PROVIDER_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export function PaymentPanel({ order, apiUrl }: { order: OrderDetail; apiUrl: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState("MANUAL");

  const pendingPayment = order.payments.find(
    (p) => p.status === "PENDING" || p.status === "AUTHORIZED",
  );
  const paidPayment = order.payments.find((p) => p.status === "PAID");

  async function generatePayment() {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Erreur (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function confirmPayment(paymentId: string) {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: getClientAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  // Commande annulée ou remboursée : le paiement est en lecture seule (aucun
  // paiement à générer ni à confirmer ; l'API refuse aussi). On n'affiche que
  // l'état des paiements existants.
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="opacity-70">
          Commande {order.status === "CANCELLED" ? "annulée" : "remboursée"} : paiement en lecture
          seule.
        </p>
        {order.payments.length === 0 ? (
          <p className="opacity-60">Aucun paiement enregistré.</p>
        ) : (
          <ul>
            {order.payments.map((payment) => (
              <li key={payment.id}>
                {paymentProviderLabel(payment.provider)} — {payment.amount} € —{" "}
                {paymentStatusLabel(payment.status)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (paidPayment) {
    return <p className="text-sm text-green-700">Paiement reçu ({paidPayment.amount} €).</p>;
  }

  if (!pendingPayment) {
    return (
      <div className="flex flex-col gap-2">
        <Select
          options={PROVIDER_OPTIONS}
          value={provider}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setProvider(e.target.value)}
        />
        <Button variant="primary" onClick={generatePayment} loading={isPending}>
          Générer le paiement
        </Button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // `revolutLink` : ancien nom de la clé, gardé pour les paiements déjà générés.
  const manualLink = pendingPayment.metadata?.paymentLink ?? pendingPayment.metadata?.revolutLink;
  const stripeCheckoutUrl = pendingPayment.metadata?.stripeCheckoutUrl;
  const paymentLink = manualLink ?? stripeCheckoutUrl;

  return (
    <div className="flex flex-col gap-4">
      {paymentLink && (
        <>
          <PaymentQrCode link={paymentLink} />
          <a href={paymentLink} target="_blank" rel="noreferrer" className="text-sm underline">
            {stripeCheckoutUrl ? "Payer par carte (Stripe)" : paymentLink}
          </a>
        </>
      )}
      <Button
        variant="secondary"
        onClick={() => confirmPayment(pendingPayment.id)}
        loading={isPending}
      >
        Marquer comme payée
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
