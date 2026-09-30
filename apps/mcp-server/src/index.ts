#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiGet, apiGetPublic } from "./api-client.js";
import {
  computeOrderStatistics,
  filterLowStockProducts,
  filterPendingOrders,
  summarizeProductionStatus,
  summarizeShipmentsStatus,
} from "./tools/logic.js";
import type {
  CampaignStatistics,
  InventoryRow,
  Order,
  ProductionBatch,
  Shipment,
} from "./types.js";

// Serveur MCP en lecture seule (cf. docs/architecture.md §34 / cahier des
// charges §34) : passe toujours par l'API REST, jamais d'accès direct à la
// base. Aucune opération d'écriture n'est exposée.
const server = new McpServer({
  name: "preorderflow",
  version: "0.1.0",
});

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

server.registerTool(
  "get_campaign_statistics",
  {
    title: "Statistiques d'une campagne",
    description:
      "Statistiques de recensement d'une campagne : nombre de personnes intéressées, quantité totale demandée, distribution par quantité, évolution dans le temps. Ne concerne jamais les commandes réelles (cf. distinction recensement/commande du cahier des charges).",
    inputSchema: { campaignSlugOrId: z.string().describe("Slug ou id de la campagne") },
  },
  async ({ campaignSlugOrId }) => {
    const stats = await apiGetPublic<CampaignStatistics>(
      `/api/v1/campaigns/${campaignSlugOrId}/statistics`,
    );
    return jsonResult(stats);
  },
);

server.registerTool(
  "get_order_statistics",
  {
    title: "Statistiques de commandes",
    description:
      "Nombre total de commandes, répartition par statut, et total d'unités commandées par produit (répond à des questions comme « combien de stylos sont actuellement commandés ? »). Exclut les commandes annulées/remboursées du total d'unités.",
    inputSchema: {},
  },
  async () => {
    const orders = await apiGet<Order[]>("/api/v1/orders");
    return jsonResult(computeOrderStatistics(orders));
  },
);

server.registerTool(
  "get_low_stock_products",
  {
    title: "Produits en rupture ou stock faible",
    description:
      "Liste les produits dont le stock disponible (physique moins réservé) est sous un seuil donné (répond à « quels produits sont en rupture ? »).",
    inputSchema: {
      threshold: z.number().int().min(0).default(10).describe("Seuil de stock disponible"),
    },
  },
  async ({ threshold }) => {
    const rows = await apiGet<InventoryRow[]>("/api/v1/inventory");
    return jsonResult(filterLowStockProducts(rows, threshold));
  },
);

server.registerTool(
  "get_pending_orders",
  {
    title: "Commandes en attente",
    description:
      "Liste les commandes pas encore livrées ni annulées (en attente de paiement, payées, en préparation, prêtes à expédier) — répond à « quelles commandes ne sont pas encore expédiées ? ».",
    inputSchema: {},
  },
  async () => {
    const orders = await apiGet<Order[]>("/api/v1/orders");
    return jsonResult(filterPendingOrders(orders));
  },
);

server.registerTool(
  "get_production_status",
  {
    title: "État de la production",
    description:
      "Lots de production actifs (planifiés ou en cours) et quantité restant à fabriquer par produit — répond à « combien dois-je encore fabriquer ? ».",
    inputSchema: {},
  },
  async () => {
    const batches = await apiGet<ProductionBatch[]>("/api/v1/production/batches");
    return jsonResult(summarizeProductionStatus(batches));
  },
);

server.registerTool(
  "get_shipments_status",
  {
    title: "État des expéditions",
    description: "Répartition des expéditions par statut, et liste de celles pas encore livrées.",
    inputSchema: {},
  },
  async () => {
    const shipments = await apiGet<Shipment[]>("/api/v1/shipments");
    return jsonResult(summarizeShipmentsStatus(shipments));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
