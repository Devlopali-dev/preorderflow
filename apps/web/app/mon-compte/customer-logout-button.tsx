"use client";

import { useRouter } from "next/navigation";
import { Button } from "@preorderflow/ui";

export function CustomerLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/customer-auth/logout", { method: "POST" });
    router.push("/mon-compte/connexion");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout}>
      Déconnexion
    </Button>
  );
}
