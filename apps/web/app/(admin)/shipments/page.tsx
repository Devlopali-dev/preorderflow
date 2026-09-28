import { getShipments } from "@/lib/api";
import { StatusSelect } from "@/components/status-select";

const SHIPMENT_STATUSES = [
  "PENDING",
  "LABEL_CREATED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "RETURNED",
];

export default async function ShipmentsPage() {
  const shipments = await getShipments();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Expéditions</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Commande</th>
            <th className="py-2">Transporteur</th>
            <th className="py-2">Suivi</th>
            <th className="py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} className="border-b">
              <td className="py-2">{shipment.order.number}</td>
              <td className="py-2">{shipment.carrier ?? "—"}</td>
              <td className="py-2">{shipment.trackingNumber ?? "—"}</td>
              <td className="py-2">
                <StatusSelect
                  apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
                  statusEndpoint={`shipments/${shipment.id}/status`}
                  currentStatus={shipment.status}
                  options={SHIPMENT_STATUSES}
                />
              </td>
            </tr>
          ))}
          {shipments.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center opacity-60">
                Aucune expédition
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
