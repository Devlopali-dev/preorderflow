import Link from "next/link";
import { getOrders } from "@/lib/api";

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Commandes</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Numéro</th>
            <th className="py-2">Client</th>
            <th className="py-2">Statut</th>
            <th className="py-2">Paiement</th>
            <th className="py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b">
              <td className="py-2">
                <Link href={`/orders/${order.id}`} className="underline">
                  {order.number}
                </Link>
              </td>
              <td className="py-2">
                {order.customer.firstName} {order.customer.lastName}
              </td>
              <td className="py-2">{order.status}</td>
              <td className="py-2">{order.paymentStatus}</td>
              <td className="py-2">
                {order.total} {order.currency}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center opacity-60">
                Aucune commande
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
