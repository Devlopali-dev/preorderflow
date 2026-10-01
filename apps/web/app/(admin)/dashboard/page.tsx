import Link from "next/link";
import { getDashboardOverview } from "@/lib/api";
import { StatCard } from "@preorderflow/ui";

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  const cards: Array<{ label: string; value: number; href: string; caption?: string }> = [
    { label: "Campagnes actives", value: overview.activeCampaigns, href: "/campaigns" },
    {
      label: "Demandes de recensement",
      value: overview.totalInterests,
      href: "/campaigns",
      caption: `${overview.interestPeople} personne${overview.interestPeople > 1 ? "s" : ""} · ${overview.interestQuantity} exemplaire${overview.interestQuantity > 1 ? "s" : ""}`,
    },
    { label: "Commandes", value: overview.totalOrders, href: "/orders" },
    // Ancres des groupes de la page commandes (id `orders-<statut>`) : le clic
    // arrive directement sur le bon groupe.
    {
      label: "Commandes à payer",
      value: overview.ordersToPay,
      href: "/orders#orders-PENDING_PAYMENT",
    },
    { label: "Commandes à préparer", value: overview.ordersToPrepare, href: "/orders#orders-PAID" },
    {
      label: "Commandes à expédier",
      value: overview.ordersToShip,
      href: "/orders#orders-READY_TO_SHIP",
    },
    { label: "Production en cours", value: overview.productionInProgress, href: "/production" },
    { label: "Livraisons en transit", value: overview.shipmentsInTransit, href: "/shipments" },
  ];

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="dashboard-card-link">
            <StatCard label={card.label} value={card.value} caption={card.caption} />
          </Link>
        ))}
      </div>
    </main>
  );
}
