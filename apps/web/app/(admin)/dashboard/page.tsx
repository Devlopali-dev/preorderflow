import { getDashboardOverview } from "@/lib/api";
import { StatCard } from "@preorderflow/ui";

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  const cards: Array<{ label: string; value: number }> = [
    { label: "Campagnes actives", value: overview.activeCampaigns },
    { label: "Demandes de recensement", value: overview.totalInterests },
    { label: "Commandes", value: overview.totalOrders },
    { label: "Commandes à payer", value: overview.ordersToPay },
    { label: "Commandes à préparer", value: overview.ordersToPrepare },
    { label: "Commandes à expédier", value: overview.ordersToShip },
    { label: "Production en cours", value: overview.productionInProgress },
    { label: "Livraisons en transit", value: overview.shipmentsInTransit },
  ];

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
    </main>
  );
}
