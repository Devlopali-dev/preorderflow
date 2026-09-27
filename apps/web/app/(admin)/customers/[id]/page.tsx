import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomer } from "@/lib/api";
import { GdprActions } from "./gdpr-actions";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await getCustomer(params.id);
  if (!customer) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">
        {customer.firstName} {customer.lastName}
      </h1>
      <p className="text-sm opacity-70">
        {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
      </p>

      <div className="mt-6">
        <h2 className="mb-2 font-medium">Commandes</h2>
        <ul className="text-sm">
          {customer.orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="underline">
                #{order.number}
              </Link>{" "}
              — {order.status} — {order.total} {order.currency}
            </li>
          ))}
          {customer.orders.length === 0 && <li className="opacity-60">Aucune commande</li>}
        </ul>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 font-medium">RGPD</h2>
        <GdprActions
          customerId={customer.id}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
        />
      </div>
    </main>
  );
}
