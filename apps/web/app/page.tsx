import Link from "next/link";
import { getCampaigns, type Campaign } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";

// Accueil public : les campagnes ouvertes aux commandes d'abord (on peut acheter), puis celles en
// recensement (on peut seulement se manifester). Un brouillon, une campagne fermée ou archivée n'y
// figure pas.
const SECTIONS = [
  {
    status: "COMMANDES_OUVERTES",
    title: "Commandes ouvertes",
    hint: "Commandez et payez en ligne.",
  },
  {
    status: "RECENSEMENT",
    title: "Recensement",
    hint: "Dites-nous combien vous en voudriez : cela ne vous engage pas à acheter.",
  },
] as const;

// Aperçu d'une campagne : sa première image, s'il y en a une (les PDF n'en sont pas).
function previewImageUrl(campaign: Campaign): string | null {
  const image = campaign.media?.find((item) => item.type === "IMAGE");
  return image ? image.url : null;
}

export default async function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const campaigns = await getCampaigns();
  const sections = SECTIONS.map((section) => ({
    ...section,
    campaigns: campaigns.filter((campaign) => campaign.status === section.status),
  })).filter((section) => section.campaigns.length > 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
        {sections.length === 0 && (
          <p className="text-sm opacity-70">Aucune campagne ouverte pour le moment.</p>
        )}

        {sections.map((section) => (
          <section
            key={section.status}
            aria-labelledby={`home-${section.status}`}
            className="flex flex-col gap-3"
          >
            <div>
              <h2 id={`home-${section.status}`} className="text-lg font-semibold">
                {section.title}
              </h2>
              <p className="text-sm opacity-70">{section.hint}</p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.campaigns.map((campaign) => {
                const image = previewImageUrl(campaign);
                return (
                  <li key={campaign.id}>
                    <Link
                      href={`/campaigns/${campaign.slug}`}
                      className="card flex h-full flex-col overflow-hidden no-underline"
                    >
                      {image ? (
                        <img
                          src={`${apiUrl}${image}`}
                          alt={`Aperçu de la campagne ${campaign.name}`}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="flex aspect-[4/3] w-full items-center justify-center bg-bg-subtle text-sm opacity-60"
                        >
                          Pas d'aperçu
                        </div>
                      )}
                      <div className="flex flex-col gap-1 p-4">
                        <h3 className="font-medium">{campaign.name}</h3>
                        {campaign.description && (
                          <p className="text-sm opacity-70">{campaign.description}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
