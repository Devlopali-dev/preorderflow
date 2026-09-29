import { redirect } from "next/navigation";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/v1/auth/setup-status`, { cache: "no-store" });
  const { needsSetup } = await res.json();

  // Un admin existe déjà : /setup ne sert plus à rien, direction /login.
  if (!needsSetup) {
    redirect("/login");
  }

  return <SetupForm />;
}
