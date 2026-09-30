import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/api";
import { InterestForm } from "./interest-form";
import { MediaGallery } from "./media-gallery";

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  const campaign = await getCampaign(params.slug);
  if (!campaign) {
    notFound();
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{campaign.name}</h1>
            {campaign.description && <p className="mt-2 opacity-80">{campaign.description}</p>}
            <p className="mt-2 text-sm opacity-70">
              Prix indicatif : {campaign.indicativePrice} {campaign.currency}
            </p>
          </div>
          <InterestForm
            campaignId={campaign.id}
            apiUrl={apiUrl}
            variants={campaign.product?.variants ?? []}
          />
        </div>

        <MediaGallery media={campaign.media} />
      </div>
    </main>
  );
}
