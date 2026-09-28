import Link from "next/link";
import { getCustomers, getOrders, getProducts } from "@/lib/api";
import { StatusSelect } from "@/components/status-select";
import { CreateOrderButton } from "./create-order-button";

const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export default async function OrdersPage() {
  const [orders, products, customers] = await Promise.all([
    getOrders(),
    getProducts(),
    getCustomers(),
  ]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <CreateOrderButton apiUrl={apiUrl} products={products} customers={customers} />
      </div>
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
              <td className="py-2">
                <StatusSelect
                  apiUrl={apiUrl}
                  statusEndpoint={`orders/${order.id}/status`}
                  currentStatus={order.status}
                  options={ORDER_STATUSES}
                />
              </td>
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
