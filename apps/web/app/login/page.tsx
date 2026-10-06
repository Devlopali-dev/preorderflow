import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/v1/auth/setup-status`, { cache: "no-store" });
  const { needsSetup } = await res.json();

  // Aucun admin encore créé : /login ne peut mener à rien, direction /setup.
  if (needsSetup) {
    redirect("/setup");
  }

  // Arrivée depuis /api/auth/session-expired : l'API a refusé la session.
  return (
    <LoginForm
      notice={
        expired
          ? "Votre session n'est plus valide (expirée, ou compte supprimé ou désactivé). Reconnectez-vous."
          : undefined
      }
    />
  );
}
