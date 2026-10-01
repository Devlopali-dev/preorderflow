import Link from "next/link";
import { getCustomerOrders } from "@/lib/api";
import { variantLabel } from "@/lib/variants";
import { CustomerNav } from "./customer-nav";
import { orderStatusLabel } from "@/lib/order-status-labels";

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
                  {order.items
                    .map(
                      (i) =>
                        `${i.quantity} × ${variantLabel(i.variant.product.name, i.variant.color)}`,
                    )
                    .join(", ")}
                </p>
                <p className="text-sm">
                  Statut : {orderStatusLabel(order.status)} — {order.total} {order.currency}
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
