"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, FormGroup, Input } from "@preorderflow/ui";

export default function CustomerLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customer/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Une erreur est survenue.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Vérifiez vos emails</h1>
        <p className="text-sm opacity-70">
          Si un compte existe avec cette adresse, un lien de connexion vient de vous être envoyé.
          Il est valable 15 minutes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <p className="mt-1 text-sm opacity-70">
          Recevez un lien de connexion par email — aucun mot de passe nécessaire.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormGroup label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />
        </FormGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={loading}>
          Recevoir mon lien de connexion
        </Button>
      </form>
    </main>
  );
}
