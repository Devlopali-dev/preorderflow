"use client";

import { useState, type ChangeEvent } from "react";
import { Button, FormGroup, Input } from "@preorderflow/ui";
import type { CustomerProfile } from "@/lib/api";
import { getClientCustomerAuthHeaders } from "@/lib/customer-auth";

export function ProfileForm({ profile, apiUrl }: { profile: CustomerProfile; apiUrl: string }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  // Adresse de livraison : celle du carnet du client, qui remonte dans l'administration.
  const shipping = profile.addresses?.find((address) => address.type === "SHIPPING");
  const [address1, setAddress1] = useState(shipping?.address1 ?? "");
  const [address2, setAddress2] = useState(shipping?.address2 ?? "");
  const [postalCode, setPostalCode] = useState(shipping?.postalCode ?? "");
  const [city, setCity] = useState(shipping?.city ?? "");
  const [country, setCountry] = useState(shipping?.country ?? "FR");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customer/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientCustomerAuthHeaders() },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'enregistrement.");

      // L'adresse est enregistrée si elle est renseignée ; à moitié remplie, on la refuse.
      const addressFields = [address1, postalCode, city];
      if (addressFields.some((value) => value.trim())) {
        if (addressFields.some((value) => !value.trim()) || country.trim().length !== 2) {
          throw new Error("Complétez l'adresse : adresse, code postal, ville et pays (2 lettres).");
        }
        const addressRes = await fetch(`${apiUrl}/api/v1/customer/me/address`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getClientCustomerAuthHeaders() },
          body: JSON.stringify({
            address1,
            address2: address2.trim() || undefined,
            postalCode,
            city,
            country,
          }),
        });
        if (!addressRes.ok) throw new Error("Erreur lors de l'enregistrement de l'adresse.");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Prénom" htmlFor="firstName">
        <Input
          id="firstName"
          value={firstName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
        />
      </FormGroup>
      <FormGroup label="Nom" htmlFor="lastName">
        <Input
          id="lastName"
          value={lastName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
        />
      </FormGroup>
      <FormGroup label="Téléphone" htmlFor="phone">
        <Input
          id="phone"
          value={phone}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
        />
      </FormGroup>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Adresse de livraison</legend>
        <FormGroup label="Adresse" htmlFor="address1">
          <Input
            id="address1"
            value={address1}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Complément d'adresse (optionnel)" htmlFor="address2">
          <Input
            id="address2"
            value={address2}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)}
          />
        </FormGroup>
        <div className="flex gap-3">
          <FormGroup label="Code postal" htmlFor="postalCode">
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Ville" htmlFor="city">
            <Input
              id="city"
              value={city}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Pays" htmlFor="country">
            <Input
              id="country"
              maxLength={2}
              value={country}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
            />
          </FormGroup>
        </div>
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Informations mises à jour.</p>}
      <Button variant="primary" onClick={onSubmit} loading={loading}>
        Enregistrer
      </Button>
    </div>
  );
}
