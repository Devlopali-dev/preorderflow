import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks Prisma avant l'import du service.
const {
  shipmentFindUnique,
  shipmentUpdate,
  shipmentEventCreate,
  inventoryMovementCreate,
  orderItemFindMany,
  customerFindUniqueOrThrow,
  orderFindUnique,
  transaction,
} = vi.hoisted(() => ({
  shipmentFindUnique: vi.fn(),
  shipmentUpdate: vi.fn(),
  shipmentEventCreate: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  orderItemFindMany: vi.fn(),
  customerFindUniqueOrThrow: vi.fn(),
  orderFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@preorderflow/database", () => ({
  prisma: {
    shipment: { findUnique: shipmentFindUnique, update: shipmentUpdate },
    shipmentEvent: { create: shipmentEventCreate },
    inventoryMovement: { create: inventoryMovementCreate },
    orderItem: { findMany: orderItemFindMany },
    customer: { findUniqueOrThrow: customerFindUniqueOrThrow },
    order: { findUnique: orderFindUnique },
    $transaction: transaction,
  },
}));

import { ShipmentService } from "./shipment.service";

describe("ShipmentService — consommation du stock à l'expédition", () => {
  const orderUpdateStatus = vi.fn();
  const sendEmail = vi.fn();
  const service = new ShipmentService(
    { updateStatus: orderUpdateStatus } as never,
    { sendEmail } as never,
  );

  const shipment = {
    id: "shp1",
    orderId: "ord1",
    status: "PENDING",
    trackingUrl: null,
    order: { paymentStatus: "PAID", customerId: "cus1" },
  };

  beforeEach(() => {
    for (const mock of [
      shipmentFindUnique,
      shipmentUpdate,
      shipmentEventCreate,
      inventoryMovementCreate,
      orderItemFindMany,
      customerFindUniqueOrThrow,
      orderFindUnique,
      transaction,
      orderUpdateStatus,
      sendEmail,
    ]) {
      mock.mockReset();
    }
    // getById : renvoie l'expédition telle quelle.
    shipmentFindUnique.mockResolvedValue(shipment);
    // updateStatus : exécute le callback de transaction avec un tx factice.
    transaction.mockImplementation(async (cb) => {
      const tx = {
        shipment: { update: shipmentUpdate },
        shipmentEvent: { create: shipmentEventCreate },
        inventoryMovement: { create: inventoryMovementCreate },
      };
      return cb(tx);
    });
    shipmentUpdate.mockImplementation((args) => Promise.resolve({ ...shipment, ...args.data }));
    shipmentEventCreate.mockResolvedValue({});
    inventoryMovementCreate.mockImplementation((args) =>
      Promise.resolve({ id: "mov", ...args.data }),
    );
    orderItemFindMany.mockResolvedValue([
      { variantId: "v1", quantity: 3 },
      { variantId: "v2", quantity: 2 },
      { variantId: "v1", quantity: 1 },
    ]);
    customerFindUniqueOrThrow.mockResolvedValue({ email: "a@x.fr" });
    orderFindUnique.mockResolvedValue(null); // loadOrderItemsHtml renvoie ""
    orderUpdateStatus.mockImplementation((id, status) => Promise.resolve({ id, status }));
    sendEmail.mockResolvedValue(true);
  });

  it("crée un mouvement SALE négatif par variante au passage à SHIPPED", async () => {
    await service.updateStatus("shp1", "SHIPPED", "colis parti");

    // v1 = 3 + 1 = 4 ; v2 = 2. Les mouvements sont créés avec des quantités négatives.
    const calls = inventoryMovementCreate.mock.calls.map((c) => c[0].data);
    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: "v1",
          quantity: -4,
          type: "SALE",
          referenceType: "ORDER",
          referenceId: "ord1",
        }),
        expect.objectContaining({
          variantId: "v2",
          quantity: -2,
          type: "SALE",
          referenceType: "ORDER",
          referenceId: "ord1",
        }),
      ]),
    );
  });

  it("ne crée aucun mouvement SALE hors expédition (ex. LABEL_CREATED)", async () => {
    await service.updateStatus("shp1", "LABEL_CREATED", "étiquette générée");

    expect(inventoryMovementCreate).not.toHaveBeenCalled();
    expect(shipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LABEL_CREATED" }) }),
    );
  });
});
