"use client";

import type { ChangeEvent } from "react";
import { Button, FormGroup, Input } from "@preorderflow/ui";
import type { CampaignVariantOption } from "@/lib/api";

export const MAX_QUANTITY = 999;

// Quantités par couleur d'un formulaire public (recensement ou achat) : un +/− par
// couleur quand il y a un choix, un simple champ numérique sinon. L'état vit dans le
// formulaire parent (une ligne par variante).
export function VariantQuantities({
  variants,
  quantities,
  setQuantity,
  itemsError,
  legend,
  singleLabel,
}: {
  variants: CampaignVariantOption[];
  quantities: Record<string, number>;
  setQuantity: (variantId: string, quantity: number) => void;
  itemsError: string | null;
  legend: string;
  singleLabel: string;
}) {
  const hasChoice = variants.length > 1 || variants.some((variant) => variant.color);

  return (
    <>
      {hasChoice ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{legend}</legend>
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
        <FormGroup label={singleLabel} htmlFor="quantity" error={itemsError ?? undefined}>
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
    </>
  );
}
