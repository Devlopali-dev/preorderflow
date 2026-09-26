"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInterestSchema, type CreateInterestInput } from "@preorderflow/types";
import { Button, FormGroup, Input, Textarea } from "@preorderflow/ui";

const formSchema = createInterestSchema.omit({ campaignId: true });
type FormValues = Omit<CreateInterestInput, "campaignId">;

export function InterestForm({ campaignId, apiUrl }: { campaignId: string; apiUrl: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { quantity: 1, consentToContact: false },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        Merci, votre intérêt a bien été enregistré. Le recensement ne constitue pas une commande
        et ne vous engage pas à acheter.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormGroup label="Combien souhaitez-vous en obtenir ?" htmlFor="quantity">
        <Input id="quantity" type="number" min={1} {...register("quantity", { valueAsNumber: true })} />
      </FormGroup>

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
