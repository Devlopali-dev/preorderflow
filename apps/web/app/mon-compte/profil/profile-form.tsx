"use client";

import { useState, type ChangeEvent } from "react";
import { Button, FormGroup, Input } from "@preorderflow/ui";
import type { CustomerProfile } from "@/lib/api";
import { getClientCustomerAuthHeaders } from "@/lib/customer-auth";

export function ProfileForm({ profile, apiUrl }: { profile: CustomerProfile; apiUrl: string }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone ?? "");
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Informations mises à jour.</p>}
      <Button variant="primary" onClick={onSubmit} loading={loading}>
        Enregistrer
      </Button>
    </div>
  );
}
