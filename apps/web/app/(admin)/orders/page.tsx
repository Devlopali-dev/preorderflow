import { getCustomers, getOrders, getProducts } from "@/lib/api";
import { CollapsibleSection } from "@/components/collapsible-section";
import { CreateOrderButton } from "./create-order-button";
import { OrderActions } from "./order-actions";
import { OrderRowButton } from "./order-row-button";

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

// Déroulé nominal d'une commande (les deux derniers statuts, annulée et remboursée, en sortent).
const FLOW_LENGTH = 7;

const PAYMENT_BADGE: Record<string, string> = {
  PENDING: "badge-default",
  AUTHORIZED: "badge-primary",
  PAID: "badge-success",
  FAILED: "badge-danger",
  REFUNDED: "badge-warning",
  PARTIALLY_REFUNDED: "badge-warning",
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-default",
  PENDING_PAYMENT: "badge-warning",
  PAID: "badge-primary",
  PROCESSING: "badge-primary",
  READY_TO_SHIP: "badge-primary",
  SHIPPED: "badge-primary",
  DELIVERED: "badge-success",
  CANCELLED: "badge-danger",
  REFUNDED: "badge-danger",
};

export default async function OrdersPage() {
  const [orders, products, customers] = await Promise.all([
    getOrders(),
    getProducts(),
    getCustomers(),
  ]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const groups = ORDER_STATUSES.map((status) => ({
    status,
    orders: orders.filter((order) => order.status === status),
  })).filter((group) => group.orders.length > 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <p className="card-subtitle">
            {orders.length} commande{orders.length > 1 ? "s" : ""} -{" "}
            <em>{ORDER_STATUSES.slice(0, FLOW_LENGTH).join(" → ")}</em>
          </p>
        </div>
        <CreateOrderButton apiUrl={apiUrl} products={products} customers={customers} />
      </div>

      {groups.length === 0 && (
        <div className="card card-body text-center text-sm opacity-60">Aucune commande</div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <CollapsibleSection
            key={group.status}
            id={`orders-${group.status}`}
            header={
              <>
                <span className={`badge ${ORDER_STATUS_BADGE[group.status] ?? "badge-default"}`}>
                  {group.status}
                </span>
                <span className="table-muted">{group.orders.length}</span>
              </>
            }
          >
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Client</th>
                    <th>Total</th>
                    <th style={{ textAlign: "center" }}>Paiement</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {group.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <OrderRowButton orderId={order.id} label={order.number} apiUrl={apiUrl} />
                      </td>
                      <td>
                        {order.customer.firstName} {order.customer.lastName}
                      </td>
                      <td>
                        {order.total} {order.currency}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${PAYMENT_BADGE[order.paymentStatus] ?? "badge-default"}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        <OrderActions orderId={order.id} status={order.status} apiUrl={apiUrl} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        ))}
      </div>
    </main>
  );
}
