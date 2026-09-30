"use client";

import { StatusActionButton } from "@/components/status-action-button";

// Reflète ALLOWED_TRANSITIONS côté API (shipment-status.ts) : le chemin normal
// d'un colis. L'API reste la seule source de vérité si jamais ça diverge.
const NEXT_STATUS: Record<string, string | undefined> = {
  PENDING: "LABEL_CREATED",
  LABEL_CREATED: "SHIPPED",
  SHIPPED: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
  EXCEPTION: "IN_TRANSIT",
};

// Un incident se signale une fois le colis parti.
const CAN_REPORT_EXCEPTION = ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"];

export function ShipmentActions({
  shipmentId,
  currentStatus,
  apiUrl,
}: {
  shipmentId: string;
  currentStatus: string;
  apiUrl: string;
}) {
  const next = NEXT_STATUS[currentStatus];
  const canReportException = CAN_REPORT_EXCEPTION.includes(currentStatus);

  if (!next && !canReportException) return null;

  const statusEndpoint = `shipments/${shipmentId}/status`;
  return (
    <div className="flex items-center gap-2">
      {next && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={statusEndpoint}
          target={next}
          label={`Passer à ${next}`}
        />
      )}
      {canReportException && (
        <StatusActionButton
          apiUrl={apiUrl}
          statusEndpoint={statusEndpoint}
          target="EXCEPTION"
          label="Signaler un incident"
          danger
        />
      )}
    </div>
  );
}
