"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPublicOrderSchema, type CreatePublicOrderInput } from "@preorderflow/types";
import { Button, FormGroup, Input, Textarea } from "@preorderflow/ui";
import { PaymentQrCode } from "@/components/payment-qr-code";
import type { CampaignVariantOption, ShippingConfig } from "@/lib/api";
import { CARRIER_LABELS, type CarrierCode, carrierRate, carriersFor } from "@/lib/shipping-tariffs";
import { VariantQuantities, MAX_QUANTITY } from "./variant-quantities";

// Précisions affichées à côté du transporteur (le libellé seul ne dit pas tout).
const CARRIER_HINTS: Partial<Record<CarrierCode, string>> = {
  LA_POSTE_SUIVIE: "avec suivi",
  LA_POSTE_VERTE: "sans suivi",
};

type Confirmation =
  | {
      kind: "order";
      orderNumber: string;
      total: string;
      currency: string;
      paymentLink: string | null;
      paymentMethod: "ONLINE" | "CASH";
    }
  | { kind: "ignored" };

// Formulaire d'ACHAT : affiché à la place du formulaire de recensement quand les commandes de
// la campagne sont ouvertes. La commande est créée, puis le client reçoit le lien pour payer
// (Revolut avec le montant) ; elle reste en attente de paiement, vérifiée à la main.
export function OrderForm({
  campaignId,
  apiUrl,
  variants,
  unitPrice,
  unitWeightKg,
  currency,
  shipping,
}: {
  campaignId: string;
  apiUrl: string;
  variants: CampaignVariantOption[];
  unitPrice: string | null;
  unitWeightKg: string | null;
  currency: string | null;
  shipping: ShippingConfig | null;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  // Une seule option : 1 exemplaire par défaut ; plusieurs couleurs : 0 partout, la personne choisit.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    variants.length === 1 ? { [variants[0]!.id]: 1 } : {},
  );
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePublicOrderInput>({
    resolver: zodResolver(createPublicOrderSchema),
    defaultValues: { country: "FR", deliveryMethod: "PICKUP", paymentMethod: "ONLINE" },
  });

  function setQuantity(variantId: string, quantity: number) {
    const clamped = Math.min(MAX_QUANTITY, Math.max(0, Number.isFinite(quantity) ? quantity : 0));
    setQuantities((current) => ({ ...current, [variantId]: clamped }));
    setItemsError(null);
  }

  const totalQuantity = variants.reduce((sum, variant) => sum + (quantities[variant.id] ?? 0), 0);
  const subtotal = unitPrice === null ? null : (Number(unitPrice) * totalQuantity).toFixed(2);
  const isPickup = watch("deliveryMethod") === "PICKUP";
  const isCash = isPickup && watch("paymentMethod") === "CASH";
  // Le liquide n'existe qu'en main propre : on repasse en ligne si la personne se fait livrer.
  useEffect(() => {
    if (!isPickup) setValue("paymentMethod", "ONLINE");
  }, [isPickup, setValue]);
  // Même règle que l'API : le poids de l'envoi (articles + emballage) détermine les transporteurs
  // possibles et leur tarif ; le choix du client retombe sur le premier transporteur disponible
  // s'il ne l'est plus.
  const weightGrams =
    totalQuantity * Number(unitWeightKg ?? 0) * 1000 + (shipping?.packagingWeightGrams ?? 0);
  // Barème indisponible (API des réglages en échec) : pas de choix, l'API retient un défaut.
  const tariffs = shipping?.tariffs ?? null;
  const allowedCarriers = tariffs === null ? [] : carriersFor(tariffs, weightGrams);
  const requestedCarrier = watch("carrier");
  const carrier: CarrierCode | null =
    requestedCarrier && allowedCarriers.includes(requestedCarrier)
      ? requestedCarrier
      : (allowedCarriers[0] ?? null);
  // Offert au-delà du seuil (sous-total HT) ; rien en main propre.
  const shippingFee =
    subtotal === null || shipping === null || tariffs === null
      ? null
      : isPickup
        ? 0
        : shipping.freeThreshold !== null && Number(subtotal) >= shipping.freeThreshold
          ? 0
          : carrier === null
            ? null
            : carrierRate(tariffs, carrier, weightGrams);

  async function onSubmit(values: CreatePublicOrderInput) {
    setServerError(null);
    const items = variants
      .map((variant) => ({ variantId: variant.id, quantity: quantities[variant.id] ?? 0 }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      setItemsError("Indiquez au moins un exemplaire.");
      return;
    }
    const { address1, address2, postalCode, city, country, ...rest } = values;
    const shippingAddress =
      values.deliveryMethod === "PICKUP"
        ? undefined
        : { address1, address2: address2 || undefined, postalCode, city, country };
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          carrier: values.deliveryMethod === "PICKUP" ? undefined : (carrier ?? undefined),
          items,
          shippingAddress,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message?.toString() ?? "Une erreur est survenue.");
      }
      const body = await res.json();
      setConfirmation(body.ignored ? { kind: "ignored" } : { kind: "order", ...body });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  if (confirmation?.kind === "ignored") {
    return (
      <div className="card p-4" role="status">
        Merci, votre commande a bien été enregistrée.
      </div>
    );
  }

  if (confirmation?.kind === "order") {
    return (
      <div className="card flex flex-col gap-3 p-4 text-sm" role="status">
        <p>
          Merci, votre commande <strong>n°{confirmation.orderNumber}</strong> est enregistrée. Un
          e-mail de confirmation vous a été envoyé.
        </p>
        <p>
          Montant à régler :{" "}
          <strong>
            {confirmation.total} {confirmation.currency}
          </strong>
        </p>
        {confirmation.paymentMethod === "CASH" ? (
          <p data-testid="cash-confirmation">
            Vous réglerez <strong>en liquide</strong> à la remise en main propre : rien à payer en
            ligne.
          </p>
        ) : confirmation.paymentLink ? (
          <>
            <a
              href={confirmation.paymentLink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary w-fit"
            >
              Payer avec Revolut
            </a>
            <PaymentQrCode link={confirmation.paymentLink} label="QR code de paiement" />
          </>
        ) : (
          <p className="opacity-70">
            Le lien de paiement n'est pas disponible : un e-mail vous indiquera comment régler.
          </p>
        )}
        {confirmation.paymentMethod !== "CASH" && (
          <p className="opacity-70">
            Indiquez vos <strong>nom et prénom</strong> dans la <strong>remarque</strong> du
            paiement. Votre commande est en attente de paiement : nous vérifions votre règlement
            manuellement.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <VariantQuantities
        variants={variants}
        quantities={quantities}
        setQuantity={setQuantity}
        itemsError={itemsError}
        legend="Quelles quantités souhaitez-vous commander, par couleur ?"
        singleLabel="Quelle quantité souhaitez-vous commander ?"
      />

      {subtotal !== null && (
        <p className="text-sm" aria-live="polite">
          Sous-total : <strong data-testid="order-subtotal">{subtotal}</strong> {currency}
        </p>
      )}
      {shippingFee !== null && (
        <p className="text-sm" aria-live="polite">
          Livraison :{" "}
          <strong data-testid="order-shipping">
            {isPickup
              ? "remise en main propre, sans frais"
              : shippingFee === 0
                ? "offerte"
                : `${shippingFee.toFixed(2)} ${currency ?? ""}`}
          </strong>
          {shipping?.freeThreshold != null && shippingFee !== 0 && !isPickup && (
            <span className="opacity-70">
              {" "}
              (offerte dès {shipping.freeThreshold.toFixed(2)} {currency} HT)
            </span>
          )}
        </p>
      )}

      <FormGroup label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" {...register("email")} />
      </FormGroup>

      <div className="flex gap-4">
        <FormGroup label="Prénom" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" {...register("firstName")} />
        </FormGroup>
        <FormGroup label="Nom" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" {...register("lastName")} />
        </FormGroup>
      </div>

      <FormGroup label="Téléphone (optionnel)" htmlFor="phone">
        <Input id="phone" {...register("phone")} />
      </FormGroup>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Mode de remise</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" value="PICKUP" {...register("deliveryMethod")} />
          Remise en main propre
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" value="SHIPPING" {...register("deliveryMethod")} />
          Me faire livrer
        </label>
      </fieldset>

      {isPickup && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Mode de paiement</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="ONLINE" {...register("paymentMethod")} />
            Payer en ligne (Revolut)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="CASH"
              {...register("paymentMethod")}
              data-testid="payment-CASH"
            />
            Payer en liquide à la remise
          </label>
        </fieldset>
      )}

      {!isPickup && shipping !== null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Transporteur</legend>
          {allowedCarriers.length === 0 && (
            <p className="text-sm text-red-600">
              Cette quantité est trop lourde pour être expédiée : réduisez-la.
            </p>
          )}
          {allowedCarriers.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value={code}
                checked={carrier === code}
                {...register("carrier")}
                data-testid={`carrier-${code}`}
              />
              <span>
                {CARRIER_LABELS[code]}
                {CARRIER_HINTS[code] ? ` (${CARRIER_HINTS[code]})` : ""} :{" "}
                <strong>
                  à partir de {carrierRate(shipping.tariffs, code, weightGrams)!.toFixed(2)}{" "}
                  {currency ?? ""}
                </strong>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {!isPickup && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Adresse de livraison</legend>
          <FormGroup label="Adresse" htmlFor="address1" error={errors.address1?.message}>
            <Input id="address1" {...register("address1")} />
          </FormGroup>
          <FormGroup label="Complément d'adresse (optionnel)" htmlFor="address2">
            <Input id="address2" {...register("address2")} />
          </FormGroup>
          <div className="flex gap-4">
            <FormGroup label="Code postal" htmlFor="postalCode" error={errors.postalCode?.message}>
              <Input id="postalCode" {...register("postalCode")} />
            </FormGroup>
            <FormGroup label="Ville" htmlFor="city" error={errors.city?.message}>
              <Input id="city" {...register("city")} />
            </FormGroup>
            <FormGroup label="Pays" htmlFor="country" error={errors.country?.message}>
              <Input id="country" maxLength={2} {...register("country")} />
            </FormGroup>
          </div>
        </fieldset>
      )}

      <FormGroup label="Remarque (optionnel)" htmlFor="notes">
        <Textarea id="notes" {...register("notes")} />
      </FormGroup>

      {/* honeypot anti-spam : caché visuellement, jamais rempli par un humain */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...register("website")}
      />

      <p className="text-xs opacity-70">
        {isCash
          ? "Ce formulaire passe une vraie commande : vous la réglerez en liquide à la remise."
          : "Ce formulaire passe une vraie commande : vous recevrez ensuite le lien pour la payer."}
      </p>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" variant="primary" loading={isSubmitting}>
        Commander
      </Button>
    </form>
  );
}
