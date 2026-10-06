import { notFound } from "next/navigation";
import { getOrder } from "@/lib/api";
import { orderStatusLabel } from "@/lib/order-status-labels";
import { variantLabel } from "@/lib/variants";
import { PaymentPanel } from "./payment-panel";
import { FulfillmentPanel } from "./fulfillment-panel";
import { OrderActions } from "../order-actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Commande #{order.number}</h1>
        <p className="text-sm opacity-70">
          {order.customer.firstName} {order.customer.lastName} — {orderStatusLabel(order.status)}
        </p>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Articles</h2>
        <ul className="text-sm">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.quantity} × {variantLabel(item.variant.product.name, item.variant.color)} —{" "}
              {item.unitPrice} €
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm font-medium">Total : {order.total} €</p>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Paiement</h2>
        <PaymentPanel
          order={order}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
        />
      </div>

      <div>
        <h2 className="mb-2 font-medium">Préparation & expédition</h2>
        <FulfillmentPanel
          order={order}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
        />
      </div>

      {/* Ne rend rien pour une commande sans action (annulée, remboursée, livrée). */}
      <OrderActions
        orderId={order.id}
        status={order.status}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
      />
    </main>
  );
}
