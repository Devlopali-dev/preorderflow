import Link from "next/link";
import { getCampaigns } from "@/lib/api";

const PUBLIC_STATUSES = ["RECENSEMENT", "COMMANDES_OUVERTES"];

export default async function HomePage() {
  const campaigns = (await getCampaigns()).filter((c) => PUBLIC_STATUSES.includes(c.status));

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">PreOrderFlow</h1>

      {campaigns.length === 0 && (
        <p className="text-sm opacity-70">Aucune campagne ouverte pour le moment.</p>
      )}

      <ul className="flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded border p-4">
            <Link href={`/campaigns/${campaign.slug}`} className="font-medium underline">
              {campaign.name}
            </Link>
            {campaign.description && (
              <p className="mt-1 text-sm opacity-70">{campaign.description}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
