"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";
import { PaymentQrCode } from "@/components/payment-qr-code";
import { getClientCustomerAuthHeaders } from "@/lib/customer-auth";

type Outcome = { kind: "now"; amount: string; paymentLink: string | null } | { kind: "later" };

// Commande à régler : le client choisit de payer tout de suite (lien Revolut avec
// le montant attendu, commande mise en attente de paiement, vérification manuelle
// ensuite) ou plus tard (un mail de validation lui parviendra).
export function PaymentChoice({
  orderId,
  apiUrl,
  currency,
  pending,
}: {
  orderId: string;
  apiUrl: string;
  currency: string;
  // Règlement manuel déjà généré (retour sur la page) : on réaffiche le lien.
  pending: { amount: string; paymentLink: string | null } | null;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(
    pending ? { kind: "now", ...pending } : null,
  );
  const [loading, setLoading] = useState<"now" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(choice: "now" | "later") {
    setError(null);
    setLoading(choice);
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/customer/me/orders/${orderId}/${choice === "now" ? "pay-now" : "pay-later"}`,
        { method: "POST", headers: { ...getClientCustomerAuthHeaders() } },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => null))?.message ?? "Une erreur est survenue.",
        );
      const body = await res.json();
      setOutcome(
        choice === "now"
          ? { kind: "now", amount: String(body.amount), paymentLink: body.paymentLink }
          : { kind: "later" },
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(null);
    }
  }

  if (outcome?.kind === "later") {
    return (
      <p className="text-sm" role="status">
        C'est noté : un e-mail vous parviendra pour valider votre commande.
      </p>
    );
  }

  if (outcome?.kind === "now") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>
          Montant à régler :{" "}
          <strong>
            {outcome.amount} {currency}
          </strong>
        </p>
        {outcome.paymentLink ? (
          <>
            <a
              href={outcome.paymentLink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary w-fit"
            >
              Payer avec Revolut
            </a>
            <PaymentQrCode link={outcome.paymentLink} label="QR code de paiement" />
          </>
        ) : (
          <p className="opacity-70">
            Le lien de paiement n'est pas disponible : un e-mail vous indiquera comment régler.
          </p>
        )}
        <p className="opacity-70">
          Indiquez vos <strong>nom et prénom</strong> dans la <strong>remarque</strong> du paiement.
          Votre commande est en attente de paiement : nous vérifions votre règlement manuellement.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>Souhaitez-vous payer directement ?</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={loading === "now"}
          disabled={loading !== null}
          onClick={() => choose("now")}
        >
          Oui, payer maintenant
        </Button>
        <Button
          variant="secondary"
          loading={loading === "later"}
          disabled={loading !== null}
          onClick={() => choose("later")}
        >
          Non, plus tard
        </Button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
