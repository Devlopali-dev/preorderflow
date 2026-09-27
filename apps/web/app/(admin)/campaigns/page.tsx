import Link from "next/link";
import { getCampaigns } from "@/lib/api";

export default async function AdminCampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Campagnes</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nom</th>
            <th className="py-2">Statut</th>
            <th className="py-2">Prix indicatif</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b">
              <td className="py-2">
                <Link href={`/campaigns/${campaign.slug}`} className="underline">
                  {campaign.name}
                </Link>
              </td>
              <td className="py-2">{campaign.status}</td>
              <td className="py-2">
                {campaign.indicativePrice} {campaign.currency}
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center opacity-60">
                Aucune campagne
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
