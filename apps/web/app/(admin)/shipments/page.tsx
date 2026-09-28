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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Expéditions</h1>
        <p className="card-subtitle">
          {shipments.length} expédition{shipments.length > 1 ? "s" : ""}
        </p>
      </div>

      {shipments.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucune expédition</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Transporteur</th>
                <th>Suivi</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.order.number}</td>
                  <td>{shipment.carrier ?? "—"}</td>
                  <td>{shipment.trackingNumber ?? "—"}</td>
                  <td>
                    <StatusSelect
                      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
                      statusEndpoint={`shipments/${shipment.id}/status`}
                      currentStatus={shipment.status}
                      options={SHIPMENT_STATUSES}
                    />
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
