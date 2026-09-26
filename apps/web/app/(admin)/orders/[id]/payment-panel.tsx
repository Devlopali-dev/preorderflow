"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { PaymentQrCode } from "./qr-code";
import type { OrderDetail } from "@/lib/api";

export function PaymentPanel({
  order,
  apiUrl,
}: {
  order: OrderDetail;
  apiUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingPayment = order.payments.find((p) => p.status === "PENDING" || p.status === "AUTHORIZED");
  const paidPayment = order.payments.find((p) => p.status === "PAID");

  async function generatePayment() {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function confirmPayment(paymentId: string) {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/payments/${paymentId}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error(`Erreur (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  if (paidPayment) {
    return <p className="text-sm text-green-700">Paiement reçu ({paidPayment.amount} €).</p>;
  }

  if (!pendingPayment) {
    return (
      <div>
        <Button variant="primary" onClick={generatePayment} loading={isPending}>
          Générer le paiement (Revolut)
        </Button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const revolutLink = pendingPayment.metadata?.revolutLink;

  return (
    <div className="flex flex-col gap-4">
      {revolutLink && (
        <>
          <PaymentQrCode link={revolutLink} />
          <a href={revolutLink} target="_blank" rel="noreferrer" className="text-sm underline">
            {revolutLink}
          </a>
        </>
      )}
      <Button variant="secondary" onClick={() => confirmPayment(pendingPayment.id)} loading={isPending}>
        Marquer comme payée
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
