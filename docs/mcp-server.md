# Serveur MCP

`apps/mcp-server` expose en lecture seule les données PreOrderFlow à un client MCP (Claude
Desktop, un agent, etc.), conformément au §34 du cahier des charges. Il ne se connecte jamais
directement à la base : il passe par l'API REST, avec un compte admin/opérateur dédié.

## Outils exposés

| Outil | Répond à |
|---|---|
| `get_campaign_statistics` | Statistiques de recensement d'une campagne |
| `get_order_statistics` | Combien de [produit] sont actuellement commandés ? |
| `get_low_stock_products` | Quels produits sont en rupture ? |
| `get_pending_orders` | Quelles commandes ne sont pas encore expédiées ? |
| `get_production_status` | Combien reste-t-il à fabriquer ? |
| `get_shipments_status` | État des expéditions en cours |

Aucune opération d'écriture n'est exposée.

## Configuration

```bash
PREORDERFLOW_API_URL=http://localhost:3001
PREORDERFLOW_MCP_EMAIL=operateur-mcp@exemple.fr
PREORDERFLOW_MCP_PASSWORD=...
```

Utiliser un compte dédié (créer un `AdminUser` avec le rôle `OPERATOR`), pas le compte admin
principal — le MCP n'a besoin que de lectures, jamais d'accès aux mutations.

## Lancer en développement

```bash
pnpm --filter mcp-server dev
```

## Utiliser avec Claude Desktop

Ajouter à la configuration MCP de Claude Desktop :

```json
{
  "mcpServers": {
    "preorderflow": {
      "command": "node",
      "args": ["/chemin/vers/preorderflow/apps/mcp-server/dist/index.js"],
      "env": {
        "PREORDERFLOW_API_URL": "http://localhost:3001",
        "PREORDERFLOW_MCP_EMAIL": "operateur-mcp@exemple.fr",
        "PREORDERFLOW_MCP_PASSWORD": "..."
      }
    }
  }
}
```

Builder d'abord avec `pnpm --filter mcp-server build`.
