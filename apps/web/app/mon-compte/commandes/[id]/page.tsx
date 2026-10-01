import { notFound } from "next/navigation";
import { getCustomerOrder } from "@/lib/api";
import { variantLabel } from "@/lib/variants";
import { orderStatusLabel } from "@/lib/order-status-labels";
import { orderPaymentStatusLabel } from "@/lib/payment-labels";
import { CustomerNav } from "../../customer-nav";
import { PaymentChoice } from "./payment-choice";

export default async function CustomerOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getCustomerOrder(params.id);
  if (!order) {
    notFound();
  }

  // Règlement manuel déjà généré et pas encore confirmé : on réaffiche son lien.
  const pendingPayment = order.payments.find(
    (payment) => payment.provider === "MANUAL" && payment.status === "PENDING",
  );

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Commande #{order.number}</h1>
        <p className="mt-1 text-sm opacity-70">Statut : {orderStatusLabel(order.status)}</p>

        <div className="mt-6">
          <h2 className="mb-2 font-medium">Articles</h2>
          <ul className="text-sm">
            {order.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {variantLabel(item.variant.product.name, item.variant.color)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-medium">
            Total : {order.total} {order.currency}
          </p>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 font-medium">Paiement</h2>
          <p className="text-sm">Statut : {orderPaymentStatusLabel(order.paymentStatus)}</p>
          {(order.status === "DRAFT" || order.status === "PENDING_PAYMENT") && (
            <div className="mt-3">
              <PaymentChoice
                orderId={order.id}
                apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
                currency={order.currency}
                pending={
                  pendingPayment
                    ? {
                        amount: pendingPayment.amount,
                        paymentLink: pendingPayment.metadata?.paymentLink ?? null,
                      }
                    : null
                }
              />
            </div>
          )}
        </div>

        {order.shipment && (
          <div className="mt-6">
            <h2 className="mb-2 font-medium">Expédition</h2>
            <p className="text-sm">
              Transporteur : {order.shipment.carrier ?? "—"} · Suivi :{" "}
              {order.shipment.trackingNumber ?? "—"}
            </p>
            {order.shipment.trackingUrl && (
              <a
                href={order.shipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                Suivre le colis
              </a>
            )}
            <p className="mt-1 text-sm">Statut : {order.shipment.status}</p>
          </div>
        )}
      </main>
    </>
  );
}
