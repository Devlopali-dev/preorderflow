"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyMagicLinkPage() {
  return (
    <Suspense fallback={null}>
      <VerifyMagicLinkContent />
    </Suspense>
  );
}

function VerifyMagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Lien de connexion invalide.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer-auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Lien de connexion invalide ou expiré.");
        }
        if (!cancelled) {
          router.push("/mon-compte");
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-semibold">Connexion impossible</h1>
          <p className="text-sm text-red-600">{error}</p>
          <a href="/mon-compte/connexion" className="text-sm underline">
            Redemander un lien
          </a>
        </>
      ) : (
        <p className="text-sm opacity-70">Connexion en cours…</p>
      )}
    </main>
  );
}
