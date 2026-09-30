"use client";

import { useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInterestSchema, type CreateInterestInput } from "@preorderflow/types";
import { Button, FormGroup, Input, Textarea } from "@preorderflow/ui";
import type { CampaignVariantOption } from "@/lib/api";

// Les quantités par couleur vivent dans un état local (une ligne par
// variante) ; react-hook-form ne valide que le reste du formulaire.
const formSchema = createInterestSchema.omit({ campaignId: true, items: true });
type FormValues = Omit<CreateInterestInput, "campaignId" | "items">;

const MAX_QUANTITY = 999;

export function InterestForm({
  campaignId,
  apiUrl,
  variants,
}: {
  campaignId: string;
  apiUrl: string;
  variants: CampaignVariantOption[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  // Une seule option : 1 exemplaire par défaut (comportement historique) ;
  // plusieurs couleurs : 0 partout, la personne choisit.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    variants.length === 1 ? { [variants[0]!.id]: 1 } : {},
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { consentToContact: false },
  });

  const hasChoice = variants.length > 1 || variants.some((variant) => variant.color);

  function setQuantity(variantId: string, quantity: number) {
    const clamped = Math.min(MAX_QUANTITY, Math.max(0, Number.isFinite(quantity) ? quantity : 0));
    setQuantities((current) => ({ ...current, [variantId]: clamped }));
    setItemsError(null);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const items = variants
      .map((variant) => ({ variantId: variant.id, quantity: quantities[variant.id] ?? 0 }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      setItemsError("Indiquez au moins un exemplaire.");
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message?.toString() ?? "Une erreur est survenue.");
      }
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  if (submitted) {
    return (
      <div className="card p-4" role="status">
        Merci, votre intérêt a bien été enregistré. Le recensement ne constitue pas une commande et
        ne vous engage pas à acheter.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {hasChoice ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            Combien souhaitez-vous en obtenir, par couleur ?
          </legend>
          {variants.map((variant) => {
            const label = variant.color?.name ?? "Standard";
            const quantity = quantities[variant.id] ?? 0;
            return (
              <div key={variant.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  {variant.color && (
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 rounded-full border"
                      style={{ backgroundColor: variant.color.hex }}
                    />
                  )}
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Retirer un exemplaire : ${label}`}
                    disabled={quantity === 0}
                    onClick={() => setQuantity(variant.id, quantity - 1)}
                  >
                    −
                  </Button>
                  <output aria-label={`Quantité : ${label}`} className="w-8 text-center">
                    {quantity}
                  </output>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Ajouter un exemplaire : ${label}`}
                    disabled={quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity(variant.id, quantity + 1)}
                  >
                    +
                  </Button>
                </span>
              </div>
            );
          })}
          {itemsError && (
            <p role="alert" className="text-sm text-red-600">
              {itemsError}
            </p>
          )}
        </fieldset>
      ) : (
        <FormGroup
          label="Combien souhaitez-vous en obtenir ?"
          htmlFor="quantity"
          error={itemsError ?? undefined}
        >
          <Input
            id="quantity"
            type="number"
            min={1}
            max={MAX_QUANTITY}
            value={variants[0] ? (quantities[variants[0].id] ?? 1) : 1}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              variants[0] && setQuantity(variants[0].id, Number(e.target.value))
            }
          />
        </FormGroup>
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

      <FormGroup label="Commentaire (optionnel)" htmlFor="comment">
        <Textarea id="comment" {...register("comment")} />
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("consentToContact")} />
        J'accepte d'être recontacté(e) au sujet de cette campagne.
      </label>

      <p className="text-xs opacity-70">
        Le recensement ne constitue pas une commande et ne vous engage pas à acheter.
      </p>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" variant="primary" loading={isSubmitting}>
        Je participe au recensement
      </Button>
    </form>
  );
}
