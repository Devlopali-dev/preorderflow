import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/api";
import { InterestForm } from "./interest-form";

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  const campaign = await getCampaign(params.slug);
  if (!campaign) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        {campaign.description && <p className="mt-2 opacity-80">{campaign.description}</p>}
        <p className="mt-2 text-sm opacity-70">
          Prix indicatif : {campaign.indicativePrice} {campaign.currency}
        </p>
      </div>
      <InterestForm
        campaignId={campaign.id}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
      />
    </main>
  );
}
