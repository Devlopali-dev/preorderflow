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

const PAYMENT_BADGE: Record<string, string> = {
  PENDING: "badge-default",
  AUTHORIZED: "badge-primary",
  PAID: "badge-success",
  FAILED: "badge-danger",
  REFUNDED: "badge-warning",
  PARTIALLY_REFUNDED: "badge-warning",
};

export default async function OrdersPage() {
  const [orders, products, customers] = await Promise.all([
    getOrders(),
    getProducts(),
    getCustomers(),
  ]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <p className="card-subtitle">
            {orders.length} commande{orders.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateOrderButton apiUrl={apiUrl} products={products} customers={customers} />
      </div>

      {orders.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucune commande</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${order.id}`} className="btn-link">
                      {order.number}
                    </Link>
                  </td>
                  <td>
                    {order.customer.firstName} {order.customer.lastName}
                  </td>
                  <td>
                    <StatusSelect
                      apiUrl={apiUrl}
                      statusEndpoint={`orders/${order.id}/status`}
                      currentStatus={order.status}
                      options={ORDER_STATUSES}
                    />
                  </td>
                  <td>
                    <span
                      className={`badge ${PAYMENT_BADGE[order.paymentStatus] ?? "badge-default"}`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td>
                    {order.total} {order.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
