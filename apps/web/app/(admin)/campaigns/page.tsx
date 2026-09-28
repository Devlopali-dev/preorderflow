import { getCampaigns, getProducts } from "@/lib/api";
import { CampaignNameButton } from "./campaign-name-button";
import { CreateCampaignButton } from "./create-campaign-button";
import { CampaignNextStatusButton } from "./campaign-next-status-button";

// Ordre du workflow métier (§5 du cahier des charges), pas alphabétique —
// une campagne DRAFT ou en cours de recensement doit remonter avant une
// campagne terminée ou annulée.
const STATUS_ORDER = [
  "DRAFT",
  "RECENSEMENT",
  "COMMANDES_OUVERTES",
  "COMMANDES_FERMEES",
  "PRODUCTION",
  "EXPEDITION",
  "TERMINEE",
  "ANNULEE",
];

export default async function AdminCampaignsPage() {
  const [campaignsRaw, products] = await Promise.all([getCampaigns(), getProducts()]);
  const campaigns = [...campaignsRaw].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campagnes</h1>
        <CreateCampaignButton apiUrl={apiUrl} products={products} />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nom</th>
            <th className="py-2">Statut</th>
            <th className="py-2">Prix indicatif</th>
            <th className="py-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b">
              <td className="py-2">
                <CampaignNameButton campaign={campaign} apiUrl={apiUrl} />
              </td>
              <td className="py-2">{campaign.status}</td>
              <td className="py-2">
                {campaign.indicativePrice} {campaign.currency}
              </td>
              <td className="py-2 text-center">
                <div className="flex justify-center">
                  <CampaignNextStatusButton
                    campaignId={campaign.id}
                    currentStatus={campaign.status}
                    apiUrl={apiUrl}
                  />
                </div>
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center opacity-60">
                Aucune campagne
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
