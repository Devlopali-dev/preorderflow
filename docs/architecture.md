# PreOrderFlow — Architecture (Phase 1)

Ce document couvre l'analyse d'architecture demandée en phase 1 : arborescence, modèle de données, machines à états, endpoints REST, points d'ambiguïté et plan de développement. Aucune implémentation fonctionnelle n'est faite à ce stade.

## 1. Arborescence du monorepo

```text
preorderflow/
├── apps/
│   ├── web/                        # Next.js (App Router) — public + admin + espace client
│   │   ├── app/
│   │   │   ├── (public)/           # page campagne, formulaire recensement
│   │   │   ├── (customer)/         # espace client via magic link
│   │   │   ├── (admin)/            # dashboard, campaigns, orders, ...
│   │   │   └── api/                # route handlers légers (proxy/BFF si besoin)
│   │   └── ...
│   └── api/                        # NestJS — API REST + Swagger
│       ├── src/
│       │   ├── modules/
│       │   │   ├── campaign/
│       │   │   ├── interest/
│       │   │   ├── product/
│       │   │   ├── customer/
│       │   │   ├── order/
│       │   │   ├── payment/
│       │   │   ├── production/
│       │   │   ├── inventory/
│       │   │   ├── shipment/
│       │   │   ├── notification/
│       │   │   ├── auth/
│       │   │   └── audit-log/
│       │   ├── common/              # guards, interceptors, pipes, decorators
│       │   └── jobs/                # processors BullMQ
│       └── ...
│
├── packages/
│   ├── database/                   # Prisma schema + client partagé + migrations + seed
│   ├── ui/                         # composants partagés (shadcn/ui wrappers)
│   ├── types/                      # DTO / types partagés front-back (zod schemas)
│   └── config/                     # eslint, tsconfig, tailwind config partagés
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── deployment.md
│   ├── deployment/coolify.md
│   ├── development.md
│   ├── security.md
│   └── contributing.md
│
├── docker/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── CLAUDE.md
├── LICENSE (AGPL-3.0)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── SECURITY.md
```

Points d'extensibilité prévus par cette structure :
- `apps/mobile` pourra s'ajouter plus tard en consommant `packages/types` et l'API REST.
- `apps/mcp-server` pourra s'ajouter en lisant directement via des services applicatifs partagés (pas d'accès direct DB hors Prisma).
- API publique versionnée : préfixe `/api/v1` dès le départ dans NestJS (voir §6).

## 2. Domaines (bounded contexts)

Chaque domaine ci-dessous est un module NestJS indépendant avec ses propres services/repositories. Aucun modèle "transaction" fourre-tout.

```text
Campaign      — cycle de vie d'une opération commerciale
Interest      — recensement (CampaignInterest)
Product       — catalogue
Customer      — identité client + adresses
Order         — commandes + lignes
Payment       — paiements
Production    — lots de fabrication
Inventory     — mouvements de stock
Shipment      — expéditions + événements
Notification  — envoi de templates par canal
Audit         — journal d'actions admin
Auth          — comptes admin (RBAC) + magic links client
```

Règle de dépendance : `Order` référence `Product`/`Customer` par id uniquement (pas de duplication de règles métier). `Inventory` ne connaît que `Product` + une référence polymorphe (`referenceType`/`referenceId`) vers `Production` ou `Order`. `Interest` ne référence jamais `Order`.

## 3. Modèle de données (vue relationnelle)

Le schéma Prisma complet est dans `packages/database/prisma/schema.prisma`. Résumé des relations clés :

```text
Campaign 1---N CampaignInterest
Campaign N---1 Product        (produit associé à la campagne)

Customer 1---N Address
Customer 1---N Order
Customer 1---N CampaignInterest (nullable, si le prospect devient identifié)

Order 1---N OrderItem
Order 1---N Payment
Order 1---1 Shipment (0..1 — une commande peut ne pas encore être expédiée)
Order N---1 Customer
Order references Address (billing + shipping) — copie figée au moment de la commande

OrderItem N---1 Product

ProductionBatch 1---N ProductionItem
ProductionItem N---1 Product
ProductionBatch (COMPLETED) ---> génère N InventoryMovement (type PRODUCTION)

InventoryMovement N---1 Product
InventoryMovement.referenceType/referenceId ---> Order | ProductionBatch (polymorphe, non-FK)

Shipment 1---N ShipmentEvent
Shipment N---1 Order

AuditLog N---1 AdminUser (userId)
```

### Pourquoi l'adresse est "copiée" sur la commande

`Order.billingAddress` / `Order.shippingAddress` sont stockées comme snapshot JSON (pas de FK vers `Address`) pour garantir qu'une commande expédiée reste historiquement correcte même si le client modifie/supprime une adresse plus tard. `Address` reste l'entité de référence pour le carnet d'adresses du client.

### Stock calculé, jamais stocké

Conformément au §13/§36 du cahier des charges : pas de colonne `Product.stock`. Le stock est dérivé de `InventoryMovement` :

```text
physicalStock  = SUM(quantity) des mouvements du produit (signe selon type)
reservedStock  = SUM(quantity) des OrderItem des commandes non terminales
                 (PENDING_PAYMENT, PAID, PROCESSING, READY_TO_SHIP) et non annulées
availableStock = physicalStock - reservedStock
```

Ce calcul est fait dans une vue/service dédié (`InventoryService.getStockSnapshot(productId)`), jamais persisté.

### Prévisions vs commandes vs production (règle du §14)

Trois entités distinctes, jamais agrégées silencieusement :

```text
Prévisions = SUM(CampaignInterest.quantity) pour une campagne
Commandes  = SUM(OrderItem.quantity) pour les commandes liées au produit de la campagne
Production = SUM(ProductionItem.quantityProduced) pour les lots liés au produit
Stock      = dérivé de InventoryMovement (voir ci-dessus)
```

Il n'existe pas de champ qui fusionnerait ces valeurs. Le dashboard campagne calcule les 4 séparément.

## 4. Machines à états

### 4.1 Campaign.status

```text
DRAFT → RECENSEMENT → COMMANDES_OUVERTES → COMMANDES_FERMÉES → PRODUCTION → EXPÉDITION → TERMINEE
                                                                                              ↑
DRAFT/RECENSEMENT/COMMANDES_OUVERTES → ANNULEE (à tout moment avant TERMINEE)
```

Transitions interdites : retour arrière (ex. `COMMANDES_FERMÉES → RECENSEMENT`), saut direct `DRAFT → PRODUCTION`.

### 4.2 Order.status

```text
DRAFT → PENDING_PAYMENT → PAID → PROCESSING → READY_TO_SHIP → SHIPPED → DELIVERED
              │                                                    
              ├──→ CANCELLED (depuis DRAFT, PENDING_PAYMENT, PAID)
              └──→ REFUNDED (depuis PAID, PROCESSING, READY_TO_SHIP, SHIPPED, DELIVERED)
```

`Order.paymentStatus` et `Order.fulfillmentStatus` sont des sous-machines indépendantes qui contraignent (sans dupliquer) `Order.status` :

```text
paymentStatus:     UNPAID → PARTIALLY_PAID → PAID → REFUNDED
fulfillmentStatus: UNFULFILLED → PROCESSING → READY_TO_SHIP → SHIPPED → DELIVERED
```

Règle : `Order.status` ne peut passer à `PAID` que si `paymentStatus = PAID`. Ne peut passer à `SHIPPED` que si un `Shipment` avec `status >= SHIPPED` existe. Implémenté via une classe `OrderStateMachine` (ex. `xstate` ou machine maison légère) appelée par le service, jamais un simple `update({status})`.

### 4.3 Payment.status

```text
PENDING → AUTHORIZED → PAID
PENDING → FAILED
PAID → REFUNDED
PAID → PARTIALLY_REFUNDED → REFUNDED
```

### 4.4 ProductionBatch.status

```text
PLANNED → IN_PROGRESS → COMPLETED
IN_PROGRESS → PARTIALLY_COMPLETED → COMPLETED
PLANNED/IN_PROGRESS → CANCELLED
```

Passage à `COMPLETED` ou `PARTIALLY_COMPLETED` : déclenche dans une transaction SQL la création des `InventoryMovement` (type `PRODUCTION`) pour chaque `ProductionItem.quantityProduced > 0`.

### 4.5 Shipment.status

```text
PENDING → LABEL_CREATED → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                                          ↓
                                     EXCEPTION → (retour manuel possible)
SHIPPED/IN_TRANSIT/OUT_FOR_DELIVERY → RETURNED
```

Chaque changement de statut crée un `ShipmentEvent` (append-only).

## 5. Ambiguïtés identifiées à valider

1. **Une commande peut-elle avoir plusieurs expéditions ?** Le cahier des charges (§16) implique une relation implicite 1-1 (`Order ↔ Shipment`), mais une commande multi-colis est fréquente. **Proposition** : `Order 1---N Shipment` dès le schéma (plus sûr), même si le MVP n'expédie qu'un colis par commande.
2. **CampaignInterest → Customer** : le lien est nullable. Faut-il dédupliquer automatiquement par email au moment du recensement (créer/rattacher un `Customer`) ou garder l'anonymat total tant qu'aucune commande n'est passée ? **Proposition** : ne pas créer de `Customer` à l'enregistrement d'un intérêt ; le lien ne se fait que si la personne passe commande avec le même email (rattachement a posteriori, jamais automatique rétroactif pour respecter le §24 RGPD).
3. **Réservation de stock** : à quel moment un `OrderItem` réserve-t-il du stock — à la création de la commande (`DRAFT`) ou seulement au passage `PENDING_PAYMENT`/`PAID` ? **Proposition** : réservation dès `PENDING_PAYMENT` (une commande `DRAFT` ne bloque rien), libérée si `CANCELLED`.
4. **Multi-devises** : `currency` est répété sur `Campaign`, `Product`, `Order`, `Payment`. Le MVP suppose une devise unique globale (EUR) mais le champ est conservé pour l'extensibilité. À confirmer que le MVP n'a pas besoin de conversion.
5. **RBAC** : seuls `ADMIN`/`OPERATOR` sont listés au §23. Faut-il que `OPERATOR` ait un accès restreint (ex. pas d'accès à `/settings` ni suppression) ? À définir précisément avant la Phase 4.
6. **Anti-spam du formulaire de recensement** (§6) : proposition technique = rate limiting IP + honeypot + option captcha (Turnstile) activable par variable d'env, sans dépendance obligatoire (cf. §32 pas de dépendance propriétaire obligatoire).
7. **Numéro de commande humain lisible** : format proposé `CMD-{année}-{séquence}` (ex. `2026-0042`), généré par séquence Postgres dédiée par année. À valider.
8. **Notifications** : le §17 ne précise pas de moteur d'envoi. Proposition : interface `NotificationProvider` avec implémentation `SMTP` par défaut (aucune dépendance propriétaire obligatoire), Resend/Brevo en implémentations optionnelles.

## 6. Endpoints REST (Phase 1 — proposition, versionnés `/api/v1`)

```http
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/interests          # public, rate-limited
GET    /api/v1/campaigns/:id/statistics

GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id

GET    /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
POST   /api/v1/customers/:id/gdpr-export
POST   /api/v1/customers/:id/gdpr-anonymize

GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id/status
POST   /api/v1/orders/:id/payments

GET    /api/v1/production/batches
POST   /api/v1/production/batches
POST   /api/v1/production/batches/:id/start
POST   /api/v1/production/batches/:id/complete

GET    /api/v1/inventory
GET    /api/v1/inventory/:productId/movements
POST   /api/v1/inventory/adjustments

GET    /api/v1/shipments
POST   /api/v1/shipments
PATCH  /api/v1/shipments/:id/status

POST   /api/v1/auth/login
POST   /api/v1/auth/magic-link
POST   /api/v1/auth/magic-link/verify

POST   /api/v1/webhooks/stripe
POST   /api/v1/webhooks/shipping
```

Toutes les routes admin protégées par guard JWT + RBAC (`ADMIN`/`OPERATOR`). Toutes les routes client protégées par un token de session issu du magic link, scoping strict sur `customerId`.

## 7. Plan de développement par commits (indicatif, Phase 2+)

```text
chore: scaffold monorepo (apps/web, apps/api, packages/*)
chore: docker-compose + postgres + redis
feat(database): prisma schema initial + migration
feat(api): nest bootstrap + swagger + health check
feat(api): campaign module (CRUD + status state machine)
feat(api): interest module + anti-spam + statistics
feat(web): page publique campagne + formulaire recensement
feat(api): customer + address module
feat(api): order module + order state machine
feat(api): payment module (manual, bank transfer)
feat(web): dashboard admin (campaigns, orders)
feat(api): production module + batch completion → inventory movements
feat(api): inventory module (stock calculé)
feat(api): shipment module + tracking events
feat(api): notification module (templates + SMTP)
feat(api): audit log interceptor
feat(auth): admin RBAC + magic link client
test: unit (stock, statuts, totaux, stats)
test: e2e (3 scénarios du cahier des charges)
docs: database/api/deployment/security/coolify
chore: seed dev
```

## 8. Points à valider avant Phase 2

- Confirmer les 8 ambiguïtés du §5.
- Confirmer le nommage exact des statuts `Campaign` avec accents (`COMMANDES_FERMÉES`) — Postgres/Prisma enum : proposition de les stocker sans accents (`COMMANDES_FERMEES`) en base et de gérer l'accent uniquement à l'affichage (i18n), à valider.
- Confirmer stack email par défaut (SMTP simple vs Resend dès le MVP).
