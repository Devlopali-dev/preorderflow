import { redirect } from "next/navigation";
import { getCustomerProfile } from "@/lib/api";
import { ProfileForm } from "./profile-form";
import { CustomerNav } from "../customer-nav";

export default async function CustomerProfilePage() {
  const profile = await getCustomerProfile();
  if (!profile) {
    redirect("/mon-compte/connexion");
  }

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-6 text-2xl font-semibold">Mon profil</h1>
        <ProfileForm
          profile={profile}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
        />
      </main>
    </>
  );
}
