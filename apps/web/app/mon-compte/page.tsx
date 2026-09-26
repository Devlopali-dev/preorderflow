import Link from "next/link";
import { getCustomerOrders } from "@/lib/api";
import { CustomerNav } from "./customer-nav";

export default async function CustomerOrdersPage() {
  const orders = await getCustomerOrders();

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Mes commandes</h1>
      {orders.length === 0 ? (
        <p className="text-sm opacity-60">Vous n'avez pas encore de commande.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded border p-4">
              <Link href={`/mon-compte/commandes/${order.id}`} className="font-medium underline">
                Commande #{order.number}
              </Link>
              <p className="text-sm opacity-70">
                {order.items.map((i) => `${i.quantity} × ${i.product.name}`).join(", ")}
              </p>
              <p className="text-sm">
                Statut : {order.status} — {order.total} {order.currency}
              </p>
              {order.shipment?.trackingNumber && (
                <p className="text-sm opacity-70">Suivi : {order.shipment.trackingNumber}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      </main>
    </>
  );
}
