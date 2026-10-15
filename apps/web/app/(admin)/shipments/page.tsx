import { getShipments } from "@/lib/api";
import { shipmentStatusLabel } from "@/lib/shipment-status-labels";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ShipmentActions } from "./shipment-actions";

// Ordre du cycle de vie d'un colis, pas alphabétique : ce qui reste à faire
// remonte avant ce qui est terminé.
const STATUS_ORDER = [
  "PENDING",
  "LABEL_CREATED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "EXCEPTION",
  "DELIVERED",
  "RETURNED",
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-default",
  LABEL_CREATED: "badge-default",
  SHIPPED: "badge-primary",
  IN_TRANSIT: "badge-primary",
  OUT_FOR_DELIVERY: "badge-warning",
  EXCEPTION: "badge-danger",
  DELIVERED: "badge-success",
  RETURNED: "badge-danger",
};

// Largeurs fixes (tableLayout: fixed) : un tableau par statut, « Suivi » doit tomber au même endroit
// dans tous, sauf dans les statuts terminaux (sans colonne Actions) où elle prend la place restante.
const ORDER_COLUMN_WIDTH = "15%";
const CARRIER_COLUMN_WIDTH = "20%";
const TRACKING_COLUMN_WIDTH = "30%";

// Statuts terminaux : plus d'action possible, la colonne Actions disparaît.
const FINAL_STATUSES = ["DELIVERED", "RETURNED"];

export default async function ShipmentsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const shipments = await getShipments();

  const groups = STATUS_ORDER.map((status) => ({
    status,
    shipments: shipments.filter((shipment) => shipment.status === status),
  })).filter((group) => group.shipments.length > 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Expéditions</h1>
        <p className="card-subtitle">
          {shipments.length} expédition{shipments.length > 1 ? "s" : ""}
        </p>
      </div>

      {groups.length === 0 && (
        <div className="card card-body text-center text-sm opacity-60">Aucune expédition</div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const showActions = !FINAL_STATUSES.includes(group.status);
          return (
            <CollapsibleSection
              key={group.status}
              header={
                <>
                  <span className={`badge ${STATUS_BADGE[group.status] ?? "badge-default"}`}>
                    {shipmentStatusLabel(group.status)}
                  </span>
                  <span className="table-muted">{group.shipments.length}</span>
                </>
              }
            >
              <div className="table-wrapper">
                <table className="table" style={{ tableLayout: "fixed", overflowWrap: "anywhere" }}>
                  <thead>
                    <tr>
                      <th style={{ width: ORDER_COLUMN_WIDTH }}>Commande</th>
                      <th style={{ width: CARRIER_COLUMN_WIDTH }}>Transporteur</th>
                      <th
                        style={{
                          width: showActions ? TRACKING_COLUMN_WIDTH : undefined,
                          textAlign: "center",
                        }}
                      >
                        Suivi
                      </th>
                      {showActions && <th style={{ textAlign: "center" }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>{shipment.order.number}</td>
                        <td>{shipment.carrier ?? "—"}</td>
                        <td className="text-center">{shipment.trackingNumber ?? "—"}</td>
                        {showActions && (
                          <td className="text-right">
                            <div className="table-cell-actions justify-end">
                              <ShipmentActions
                                shipmentId={shipment.id}
                                currentStatus={shipment.status}
                                apiUrl={apiUrl}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          );
        })}
      </div>
    </main>
  );
}
