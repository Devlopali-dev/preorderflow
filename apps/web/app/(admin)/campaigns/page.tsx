import { getCampaigns, getProducts } from "@/lib/api";
import { CollapsibleSection } from "@/components/collapsible-section";
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

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-default",
  RECENSEMENT: "badge-primary",
  COMMANDES_OUVERTES: "badge-primary",
  COMMANDES_FERMEES: "badge-warning",
  PRODUCTION: "badge-warning",
  EXPEDITION: "badge-warning",
  TERMINEE: "badge-success",
  ANNULEE: "badge-danger",
};

export default async function AdminCampaignsPage() {
  const [campaignsRaw, products] = await Promise.all([getCampaigns(), getProducts()]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const groups = STATUS_ORDER.map((status) => ({
    status,
    campaigns: campaignsRaw.filter((campaign) => campaign.status === status),
  })).filter((group) => group.campaigns.length > 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campagnes</h1>
          <p className="card-subtitle">
            {campaignsRaw.length} campagne{campaignsRaw.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateCampaignButton apiUrl={apiUrl} products={products} />
      </div>

      {groups.length === 0 && (
        <div className="card card-body text-center text-sm opacity-60">Aucune campagne</div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <CollapsibleSection
            key={group.status}
            header={
              <>
                <span className={`badge ${STATUS_BADGE[group.status] ?? "badge-default"}`}>
                  {group.status}
                </span>
                <span className="table-muted">{group.campaigns.length}</span>
              </>
            }
          >
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prix indicatif</th>
                    {group.status !== "TERMINEE" && <th style={{ textAlign: "center" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {group.campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>
                        <CampaignNameButton campaign={campaign} apiUrl={apiUrl} />
                      </td>
                      <td>
                        {campaign.indicativePrice} {campaign.currency}
                      </td>
                      {group.status !== "TERMINEE" && (
                        <td className="text-center">
                          <div className="table-cell-actions justify-center">
                            <CampaignNextStatusButton
                              campaignId={campaign.id}
                              currentStatus={campaign.status}
                              apiUrl={apiUrl}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        ))}
      </div>
    </main>
  );
}
