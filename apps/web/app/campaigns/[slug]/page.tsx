import { notFound } from "next/navigation";
import { getCampaign, getShippingConfig } from "@/lib/api";
import { InterestForm } from "./interest-form";
import { OrderForm } from "./order-form";
import { MediaGallery } from "./media-gallery";
import { SiteHeader } from "@/components/site-header";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) {
    notFound();
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // RECENSEMENT : formulaire de recensement. COMMANDES_OUVERTES : formulaire d'achat. Ensuite
  // (commandes fermées, production, expédition, archives) : plus de formulaire. DRAFT : la
  // campagne n'est visible que d'un administrateur (l'API la cache au public) : aperçu seulement.
  const isOpenForOrders = campaign.status === "COMMANDES_OUVERTES";
  const shipping = isOpenForOrders ? await getShippingConfig() : null;
  const isClosed = !["DRAFT", "RECENSEMENT", "COMMANDES_OUVERTES"].includes(campaign.status);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">{campaign.name}</h1>
              {campaign.description && <p className="mt-2 opacity-80">{campaign.description}</p>}
              {campaign.product && (
                <p className="mt-2 text-sm opacity-70">
                  {isOpenForOrders ? "Prix" : "Prix indicatif"} : {campaign.product.price}{" "}
                  {campaign.product.currency}
                </p>
              )}
            </div>
            {/* Le formulaire suit le statut de la campagne : recensement, achat, ou fermé. */}
            {campaign.status === "DRAFT" ? (
              <div className="card p-4 text-sm" role="status">
                Aperçu administrateur : cette campagne est un brouillon, invisible du public. Le
                formulaire apparaîtra dès son passage en recensement.
              </div>
            ) : isOpenForOrders ? (
              <OrderForm
                campaignId={campaign.id}
                apiUrl={apiUrl}
                variants={campaign.product?.variants ?? []}
                unitPrice={campaign.product?.price ?? null}
                unitWeightKg={campaign.product?.weight ?? null}
                currency={campaign.product?.currency ?? null}
                shipping={shipping}
              />
            ) : isClosed ? (
              <div className="card p-4 text-sm" role="status">
                Les commandes de cette campagne sont fermées.
              </div>
            ) : (
              <InterestForm
                campaignId={campaign.id}
                apiUrl={apiUrl}
                variants={campaign.product?.variants ?? []}
              />
            )}
          </div>

          <MediaGallery photos={campaign.product?.photos ?? []} media={campaign.media} />
        </div>
      </main>
    </>
  );
}
