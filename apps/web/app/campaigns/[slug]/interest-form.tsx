"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInterestSchema, type CreateInterestInput } from "@preorderflow/types";
import { Button, FormGroup, Input, Textarea } from "@preorderflow/ui";
import type { CampaignVariantOption } from "@/lib/api";
import { MAX_QUANTITY, VariantQuantities } from "./variant-quantities";

// Les quantités par couleur vivent dans un état local (une ligne par
// variante) ; react-hook-form ne valide que le reste du formulaire.
const formSchema = createInterestSchema.omit({ campaignId: true, items: true });
type FormValues = Omit<CreateInterestInput, "campaignId" | "items">;

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
      <VariantQuantities
        variants={variants}
        quantities={quantities}
        setQuantity={setQuantity}
        itemsError={itemsError}
        legend="Combien souhaitez-vous en obtenir, par couleur ?"
        singleLabel="Combien souhaitez-vous en obtenir ?"
      />

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
