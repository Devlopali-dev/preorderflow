import { getCampaigns, getCustomers, getOrders, getProducts } from "@/lib/api";
import { ORDER_PAYMENT_STATUS_BADGE, orderPaymentStatusLabel } from "@/lib/payment-labels";
import { orderStatusLabel } from "@/lib/order-status-labels";
import { CollapsibleSection } from "@/components/collapsible-section";
import { BulkMessageButton } from "./bulk-message-button";
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

// Commandes terminées : aucune action possible, la colonne serait vide.
const NO_ACTION_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED"];

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
  const [orders, products, customers, campaigns] = await Promise.all([
    getOrders(),
    getProducts(),
    getCustomers(),
    getCampaigns(),
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
            <em>{ORDER_STATUSES.slice(0, FLOW_LENGTH).map(orderStatusLabel).join(" → ")}</em>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <BulkMessageButton apiUrl={apiUrl} orders={orders} />
          <CreateOrderButton
            apiUrl={apiUrl}
            products={products}
            customers={customers}
            campaigns={campaigns}
          />
        </div>
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
                  {orderStatusLabel(group.status)}
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
                    {!NO_ACTION_STATUSES.includes(group.status) && (
                      <th style={{ textAlign: "center" }}>Action</th>
                    )}
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
                          className={`badge ${ORDER_PAYMENT_STATUS_BADGE[order.paymentStatus] ?? "badge-default"}`}
                        >
                          {orderPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </td>
                      {!NO_ACTION_STATUSES.includes(group.status) && (
                        <td className="text-right">
                          <OrderActions
                            orderId={order.id}
                            status={order.status}
                            apiUrl={apiUrl}
                            align="end"
                          />
                        </td>
                      )}
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
