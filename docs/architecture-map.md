# PreOrderFlow — Carte d'architecture (Mermaid)

Diagrammes Mermaid exploitables de l'application v0.35.1.
Rendus nativement par GitHub, GitLab et la plupart des éditeurs Markdown.

---

## 1. Vue d'ensemble — monorepo

```mermaid
flowchart LR
    subgraph APPS["APPS"]
        WEB["🌐 apps/web<br/>Next.js 16 · App Router<br/>Site public + Admin + Portail client"]
        API["⚙️ apps/api<br/>NestJS · REST · Swagger<br/>Source de vérité des règles métier"]
        MCP["🤖 apps/mcp-server<br/>MCP Server (Hono)<br/>Lecture via l'API"]
    end

    subgraph PKGS["PACKAGES"]
        DB["🗄️ packages/database<br/>Prisma · PostgreSQL"]
        UI["🧩 packages/ui"]
        TYPES["📦 packages/types<br/>Zod partagé"]
        CFG["🔧 packages/config"]
    end

    EXT["🌍 Externes<br/>Stripe · Revolut (lien)<br/>Resend/SMTP · ntfy<br/>data.laposte.fr"]

    WEB -->|"HTTP /api/v1/* · Bearer"| API
    MCP -->|"lecture"| API
    API -->|"Prisma ORM"| DB
    API -->|"webhooks / providers"| EXT
```

---

## 2. Modules backend (apps/api) et leurs dépendances

```mermaid
flowchart TD
    APP["AppModule"]
    AUTH["AuthModule<br/>admin JWT + RBAC<br/>(gardes globaux)"]
    CAUTH["CustomerAuthModule<br/>magic links + portail /customer/me"]

    APP --> AUTH
    APP --> CAUTH

    CAMP["CampaignModule"]
    CUST["CustomerModule"]
    PROD["ProductModule"]
    COLOR["ColorModule"]
    ORDER["OrderModule"]
    PAY["PaymentModule"]
    BATCH["ProductionModule"]
    INV["InventoryModule"]
    SHIP["ShipmentModule"]
    DASH["DashboardModule"]
    SET["SettingsModule"]
    NOTIF["NotificationModule"]
    AUDIT["AuditModule"]

    APP --> CAMP & CUST & PROD & COLOR & ORDER & PAY & BATCH & INV & SHIP & DASH & SET & NOTIF & AUDIT

    CAMP --> NOTIF & AUDIT & ORDER & PAY
    CUST --> AUDIT
    ORDER -->|"forwardRef"| PAY
    PAY -->|"forwardRef"| ORDER
    ORDER --> NOTIF & AUDIT & SET
    PAY --> NOTIF & AUDIT
    BATCH --> AUDIT
    INV --> AUDIT
    SHIP --> ORDER & NOTIF & AUDIT
    SET --> AUDIT
    NOTIF --> SET
    CAUTH --> AUTH & NOTIF & PAY
```

---

## 3. Modèle de données (Prisma — PostgreSQL)

```mermaid
erDiagram
    AdminUser ||--o{ AuditLog : "écrit"
    Campaign ||--o{ CampaignMedia : "a"
    Campaign ||--o{ CampaignInterest : "reçoit"
    CampaignInterest ||--o{ CampaignInterestItem : "détaille"
    Campaign ||--o{ Order : "génère"
    Product ||--o{ ProductPhoto : "a"
    Product ||--o{ ProductVariant : "a"
    Color ||--o{ ProductVariant : "couleur"
    Customer ||--o{ Address : "a"
    Customer ||--o{ CampaignInterest : "remplit"
    Customer ||--o{ Order : "passe"
    Order ||--o{ OrderItem : "contient"
    OrderItem ||--o{ ProductVariant : "réfère"
    Order ||--o{ Payment : "payé par"
    ProductionBatch ||--o{ ProductionItem : "produit"
    ProductionItem ||--o{ ProductVariant : "réfère"
    ProductVariant ||--o{ InventoryMovement : "stocké par"
    Order ||--o{ Shipment : "expédié par"
    Shipment ||--o{ ShipmentEvent : "trace"
    Order ||--o{ AuditLog : "journalisé"
    AppSettings ||--o{ NotificationTemplateOverride : "personnalise"

    AdminUser {
        uuid id PK
        string email
        string passwordHash
        AdminRole role
        boolean active
    }
    Campaign {
        uuid id PK
        string name
        string slug
        CampaignStatus status
        datetime startDate
        datetime endDate
    }
    CampaignInterest {
        uuid id PK
        string email
        string firstName
        string lastName
        int quantity
        boolean consentToContact
    }
    Product {
        uuid id PK
        string sku
        string name
        string slug
        decimal price
        string currency
        boolean manufacturable
    }
    ProductVariant {
        uuid id PK
        uuid productId FK
        uuid colorId FK
        boolean active
    }
    Customer {
        uuid id PK
        string email
        string firstName
        string lastName
    }
    Order {
        uuid id PK
        string number
        OrderStatus status
        OrderPaymentStatus paymentStatus
        OrderFulfillmentStatus fulfillmentStatus
        decimal total
    }
    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid variantId FK
        int quantity
    }
    Payment {
        uuid id PK
        uuid orderId FK
        PaymentProvider provider
        PaymentStatus status
        decimal amount
    }
    ProductionBatch {
        uuid id PK
        string reference
        ProductionBatchStatus status
        int quantityProduced
    }
    InventoryMovement {
        uuid id PK
        uuid variantId FK
        int quantity
        InventoryMovementType type
        string referenceType
        string referenceId
    }
    Shipment {
        uuid id PK
        uuid orderId FK
        Carrier carrier
        string trackingNumber
        ShipmentStatus status
    }
    ShipmentEvent {
        uuid id PK
        uuid shipmentId FK
        ShipmentStatus status
    }
    AuditLog {
        uuid id PK
        AuditAction action
        string entityType
        string entityId
    }
```

---

## 4. Workflow métier fondamental (jamais fusionné)

```mermaid
flowchart LR
    I["INTÉRÊT<br/>CampaignInterest"]
    O["COMMANDE<br/>Order"]
    P["PAIEMENT<br/>Payment"]
    PR["PRODUCTION<br/>ProductionBatch"]
    S["STOCK<br/>InventoryMovement"]
    F["PRÉPARATION<br/>Order → PROCESSING"]
    SH["EXPÉDITION<br/>Shipment"]
    D["LIVRAISON<br/>DELIVERED"]

    I -.->|"prévision uniquement<br/>(jamais une commande)"| O
    O --> P
    O -.->|"reserve stock"| S
    PR -->|"crée des mouvements +"| S
    P --> F
    F --> SH
    SH --> D
```

---

## 5. Machines à états

### Statut de commande

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING_PAYMENT
    DRAFT --> CANCELLED
    PENDING_PAYMENT --> PAID
    PENDING_PAYMENT --> CANCELLED
    PAID --> PROCESSING
    PAID --> CANCELLED
    PAID --> REFUNDED
    PROCESSING --> READY_TO_SHIP
    PROCESSING --> REFUNDED
    READY_TO_SHIP --> SHIPPED
    READY_TO_SHIP --> REFUNDED
    SHIPPED --> DELIVERED
    SHIPPED --> REFUNDED
    DELIVERED --> [*]
    CANCELLED --> [*]
    REFUNDED --> [*]
```

### Statut de campagne

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> RECENSEMENT
    RECENSEMENT --> COMMANDES_OUVERTES
    COMMANDES_OUVERTES --> COMMANDES_FERMEES
    COMMANDES_FERMEES --> PRODUCTION
    PRODUCTION --> EXPEDITION
    EXPEDITION --> TERMINEE
    DRAFT --> ANNULEE
    RECENSEMENT --> ANNULEE
    COMMANDES_OUVERTES --> ANNULEE
    COMMANDES_FERMEES --> ANNULEE
    PRODUCTION --> ANNULEE
    EXPEDITION --> ANNULEE
    TERMINEE --> DRAFT
    ANNULEE --> DRAFT
```

### Statut de production

```mermaid
stateDiagram-v2
    [*] --> PLANNED
    PLANNED --> IN_PROGRESS
    PLANNED --> CANCELLED
    IN_PROGRESS --> PARTIALLY_COMPLETED
    IN_PROGRESS --> COMPLETED
    IN_PROGRESS --> CANCELLED
    PARTIALLY_COMPLETED --> COMPLETED
    COMPLETED --> [*]
    CANCELLED --> [*]
```

### Statut d'expédition

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> LABEL_CREATED
    PENDING --> SHIPPED
    LABEL_CREATED --> SHIPPED
    SHIPPED --> IN_TRANSIT
    SHIPPED --> OUT_FOR_DELIVERY
    SHIPPED --> DELIVERED
    SHIPPED --> EXCEPTION
    SHIPPED --> RETURNED
    IN_TRANSIT --> OUT_FOR_DELIVERY
    IN_TRANSIT --> DELIVERED
    IN_TRANSIT --> EXCEPTION
    IN_TRANSIT --> RETURNED
    OUT_FOR_DELIVERY --> DELIVERED
    OUT_FOR_DELIVERY --> EXCEPTION
    OUT_FOR_DELIVERY --> RETURNED
    EXCEPTION --> IN_TRANSIT
    EXCEPTION --> OUT_FOR_DELIVERY
    EXCEPTION --> DELIVERED
    EXCEPTION --> RETURNED
    DELIVERED --> [*]
    RETURNED --> [*]
```

---

## 6. Calcul du stock (toujours dérivé, jamais stocké)

```mermaid
flowchart LR
    subgraph ENTREES["Entrées"]
        PROD["PRODUCTION (+)"]
        RET["RETURN (+)"]
        ADJIN["ADJUSTMENT_IN (+)"]
    end
    subgraph SORTIES["Sorties"]
        SALE["SALE (−)"]
        DAM["DAMAGE (−)"]
        ADJOUT["ADJUSTMENT_OUT (−)"]
        TR["TRANSFER (±)"]
    end

    ENTREES --> PHYS["physicalStock"]
    SORTIES --> PHYS
    RES["Réservé depuis commandes<br/>PARTIALLY_PAID / PAID"] --> RESV["reservedStock"]

    PHYS --> AVAIL["availableStock"]
    RESV --> AVAIL
    AVAIL["availableStock = physicalStock − reservedStock"]
```

---

## 7. Vue applicative — requêtes frontend → backend

```mermaid
sequenceDiagram
    participant B as Navigateur (Next.js)
    participant A as NestJS API

    Note over B,A: Lecture (Server Components via lib/api.ts)
    B->>A: GET /api/v1/campaigns
    B->>A: GET /api/v1/campaigns/:slug
    B->>A: GET /api/v1/dashboard
    B->>A: GET /api/v1/orders · /inventory · /shipments · /production/batches

    Note over B,A: Mutation (client → API directe + router.refresh)
    B->>A: POST /api/v1/campaigns/:id/interests  (recensement public, anti-spam)
    B->>A: POST /api/v1/campaigns/:id/orders     (commande publique)
    B->>A: PATCH /api/v1/orders/:id/status
    B->>A: POST /api/v1/orders/:id/payments
    B->>A: POST /api/v1/shipments/hand-delivery
    B->>A: POST /api/v1/production/batches/:id/complete

    Note over B,A: Portail client (magic link)
    B->>A: POST /api/v1/customer/auth/magic-link
    B->>A: GET /api/v1/customer/me/orders
    B->>A: POST /api/v1/customer/me/orders/:id/pay-now
```

---

## 8. Intégrations externes

```mermaid
flowchart LR
    API["apps/api"]

    API -->|"webhook checkout.session.completed<br/>(signature vérifiée)"| STRIPE["Stripe"]
    API -->|"lien revolut.me (pas d'API)"| REV["Revolut"]
    API -->|"Resend API / SMTP / console"| MAIL["Email"]
    API -->|"ntfy push (alerts admin)"| NTFY["ntfy.sh"]
    API -->|"barèmes (GET, sans clé)"| LAPOSTE["data.laposte.fr"]
    API -.->|"Mondial Relay (barème codé en dur)"| MR["Mondial Relay"]
```
