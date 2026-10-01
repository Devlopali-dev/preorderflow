"use client";

import type { ChangeEvent } from "react";
import { Input } from "@preorderflow/ui";
import { PaymentQrCode } from "@/components/payment-qr-code";

// Lien de paiement d'une campagne (facultatif) et son QR code, généré à
// l'affichage. Le montant d'une commande est ajouté plus tard, au moment de
// générer le paiement (cf. buildRevolutPaymentLink côté API).
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CampaignPaymentLinkField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const link = value.trim();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        Lien de paiement (optionnel)
        <Input
          type="url"
          placeholder="https://revolut.me/pseudo?currency=EUR&amount="
          value={value}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </label>
      <p className="form-hint">
        Remplace le lien du .env pour les commandes de cette campagne. Avec Revolut, le montant est
        ajouté automatiquement.
      </p>
      {link && isHttpUrl(link) && <PaymentQrCode link={link} label="QR code du lien de paiement" />}
    </div>
  );
}
