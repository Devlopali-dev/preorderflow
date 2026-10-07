"use client";

import type { ChangeEvent } from "react";

// Mode livraison d'une campagne : désactivé, le formulaire de commande ne propose que la remise
// en main propre (et l'API refuse les commandes publiques en livraison).
export function CampaignShippingField({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          data-testid="campaign-shipping-enabled"
        />
        Proposer la livraison
      </label>
      <p className="form-hint">
        {checked
          ? "Les clients peuvent choisir la remise en main propre ou la livraison."
          : "Livraison désactivée : seule la remise en main propre est proposée."}
      </p>
    </div>
  );
}
