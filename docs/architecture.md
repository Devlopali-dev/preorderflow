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
Product       — catalogue (+ variantes par couleur, palette globale Color)
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

Règle de dépendance : `Order` référence `ProductVariant`/`Customer` par id uniquement (pas de duplication de règles métier). `Inventory` ne connaît que `ProductVariant` + une référence polymorphe (`referenceType`/`referenceId`) vers `Production` ou `Order`. `Interest` ne référence jamais `Order`.

### Variantes (couleurs)

Une campagne vend un produit ; un produit peut se décliner en couleurs. L'unité vendable et stockable est la **variante** (`ProductVariant`), pas le produit : stock, lignes de commande, lots de production et intérêts référencent tous la variante.

- `Color` est une palette globale gérée depuis les modales de création et d'édition d'un produit (nom + pastille `#rrggbb`, palette de base de 16 couleurs proposée), réutilisable par tous les produits. Une couleur se supprime tant qu'aucune variante ne l'utilise (l'API refuse sinon, il faut alors la désactiver) ; une couleur inactive reste listée, en italique avec un badge d'avertissement.
- Un produit sans couleur a une variante **Standard** (`colorId = null`, SKU du produit), créée avec lui. Ajouter une première couleur retire le Standard si rien ne le référence encore.
- **Désactiver une couleur la retire** : la variante est supprimée si elle ne porte aucun historique (stock, réservé et disponible nuls, et aucun mouvement, commande, lot de production ni intérêt). Sinon elle reste, marquée inactive, et peut être réactivée. Ce critère s'appuie sur les références plutôt que sur le seul stock : une variante à stock nul peut avoir des commandes passées, et la base interdit de la supprimer.
- **Pas de couleur = Standard** : quand un produit n'a plus de variante active, la variante Standard est créée ou réactivée. Elle ne se désactive jamais (l'API refuse). Un produit garde donc toujours une variante active, sans que ce soit une contrainte pour l'admin.
- Le **slug** d'un produit n'est pas saisi : il est généré depuis le nom (`nom-du-produit`, suffixe `-2`, `-3`… en cas de doublon). Le **SKU** se propose depuis le nom dans l'interface et reste modifiable.
- Une campagne propose toutes les variantes **actives** de son produit. La page publique reçoit id + couleur, jamais de SKU ni de stock.
- Une personne peut demander plusieurs couleurs avec un seul consentement : `CampaignInterest` porte une ligne `CampaignInterestItem` par couleur. Sa quantité totale est dérivée (somme des lignes), jamais stockée.
- `@@unique([productId, colorId])` ne protège pas la variante par défaut (PostgreSQL traite deux `NULL` comme distincts) : l'unicité de la variante sans couleur est garantie par le service produit.

## 3. Modèle de données (vue relationnelle)

Le schéma Prisma complet est dans `packages/database/prisma/schema.prisma`. Résumé des relations clés :

```text
Campaign 1---N CampaignInterest
Campaign N---1 Product        (produit associé à la campagne)

Product 1---N ProductVariant  (une variante par couleur, ou une variante par défaut)
ProductVariant N---1 Color    (nullable : variante par défaut sans couleur)
CampaignInterest 1---N CampaignInterestItem
CampaignInterestItem N---1 ProductVariant

Customer 1---N Address
Customer 1---N Order
Customer 1---N CampaignInterest (nullable, si le prospect devient identifié)

Order 1---N OrderItem
Order 1---N Payment
Order 1---1 Shipment (0..1 — une commande peut ne pas encore être expédiée)
Order N---1 Customer
Order 1---1 Shipment (une commande = un colis, décision validée)
Order references Address (billing + shipping) — copie figée au moment de la commande

OrderItem N---1 ProductVariant

ProductionBatch 1---N ProductionItem
ProductionItem N---1 ProductVariant
ProductionBatch (COMPLETED) ---> génère N InventoryMovement (type PRODUCTION)

InventoryMovement N---1 ProductVariant
InventoryMovement.referenceType/referenceId ---> Order | ProductionBatch (polymorphe, non-FK)

Shipment 1---N ShipmentEvent
Shipment N---1 Order

AuditLog N---1 AdminUser (userId)
```

### Pourquoi l'adresse est "copiée" sur la commande

`Order.billingAddress` / `Order.shippingAddress` sont stockées comme snapshot JSON (pas de FK vers `Address`) pour garantir qu'une commande expédiée reste historiquement correcte même si le client modifie/supprime une adresse plus tard. `Address` reste l'entité de référence pour le carnet d'adresses du client.

### Stock calculé, jamais stocké

Conformément au §13/§36 du cahier des charges : pas de colonne `Product.stock`. Le stock est dérivé de `InventoryMovement`, **par variante** ; le stock d'un produit est la somme de ses variantes :

```text
physicalStock  = SUM(quantity) des mouvements de la variante (signe selon type)
reservedStock  = SUM(quantity) des OrderItem des commandes ayant reçu au moins
                 un paiement (paymentStatus IN (PARTIALLY_PAID, PAID)) et non
                 terminales/annulées (PAID, PROCESSING, READY_TO_SHIP)
availableStock = physicalStock - reservedStock
```

Ce calcul est fait dans une vue/service dédié (`InventoryService.getStockSnapshot(variantId)`, somme via `sumStockSnapshots`), jamais persisté. Une couleur en rupture ne masque pas le stock des autres.

### Prévisions vs commandes vs production (règle du §14)

Trois entités distinctes, jamais agrégées silencieusement :

```text
Prévisions = SUM(CampaignInterestItem.quantity) pour une campagne (ventilable par variante)
Commandes  = SUM(OrderItem.quantity) pour les commandes liées aux variantes du produit de la campagne
Production = SUM(ProductionItem.quantityProduced) pour les lots liés aux variantes du produit
Stock      = dérivé de InventoryMovement (voir ci-dessus)
```

Il n'existe pas de champ qui fusionnerait ces valeurs. Le dashboard campagne calcule les 4 séparément.

## 4. Machines à états

### 4.1 Campaign.status

```text
DRAFT → RECENSEMENT → COMMANDES_OUVERTES → COMMANDES_FERMÉES → PRODUCTION → EXPÉDITION → TERMINEE
                                                                                              ↑
Tout statut non terminal → ANNULEE (jusqu'à EXPÉDITION inclus)
```

Transitions interdites : retour arrière (ex. `COMMANDES_FERMÉES → RECENSEMENT`), saut direct `DRAFT → PRODUCTION`.

ANNULEE est volontairement atteignable depuis n'importe quel statut non terminal (pas seulement
avant l'ouverture des commandes) : une campagne en cours dont le recensement a des inscrits ne peut
pas être supprimée (`DELETE /campaigns/:id` refuse s'il existe un `CampaignInterest`, cf. §8), donc
si ANNULEE n'était pas atteignable au-delà de `COMMANDES_OUVERTES`, une campagne avancée resterait
bloquée sans aucune sortie.

**Archives.** `TERMINEE` et `ANNULEE` sont les statuts _archivés_ :

- **lecture seule** : l'API refuse la modification, l'ajout ou le retrait d'aperçus et le
  recensement (400) tant que la campagne est archivée ;
- **réactivation** : seule transition possible depuis une archive, `TERMINEE|ANNULEE → DRAFT`. La
  campagne repart du début du cycle. Action tracée (`CAMPAIGN_REACTIVATED`) ;
- **suppression définitive** : `DELETE /campaigns/:id` sur une archive supprime la campagne, ses
  demandes de recensement (et leurs lignes par couleur) et ses fichiers. Réservée aux `ADMIN`, tracée
  (`CAMPAIGN_DELETED`, avec le nombre de demandes supprimées). Les clients restent : ils peuvent avoir
  des commandes. Les données de recensement se suppriment indépendamment des commandes (§24).

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

**Référence.** Facultative à la création : à défaut, `nom-AAAAMMJJ` (nom du premier produit, date UTC), suffixée `#1`, `#2`… en cas de doublon. Générée sous verrou consultatif ; une référence saisie déjà prise est refusée (400).

**Correction (`POST /production/batches/:id/decrement`).** Retire des unités déjà déclarées produites (erreur de saisie, casse). Le stock étant dérivé des mouvements, l'historique n'est jamais réécrit : la baisse de `quantityProduced` et un mouvement négatif (`ADJUSTMENT_OUT`, référencé sur le lot) sont écrits dans la même transaction. Règles, vérifiées côté API :

- uniquement sur un lot `IN_PROGRESS` ou `PARTIALLY_COMPLETED` (un lot terminé est clos) ;
- pas plus que la quantité déjà produite sur la ligne (baisse atomique : deux corrections simultanées ne peuvent pas la dépasser) ;
- le stock physique de la variante ne doit jamais passer sous zéro (unités déjà sorties du stock : refus).

Le statut du lot ne change pas (la machine à états ne prévoit pas de retour en arrière). L'action est tracée (`INVENTORY_ADJUSTED`).

### 4.5 Shipment.status

```text
PENDING → LABEL_CREATED → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                                          ↓
                                     EXCEPTION → (retour manuel possible)
SHIPPED/IN_TRANSIT/OUT_FOR_DELIVERY → RETURNED
```

Chaque changement de statut crée un `ShipmentEvent` (append-only).

## 5. Ambiguïtés — décisions

1. **Shipment par commande** : **1-1** (`Order.shipment`, `Shipment.orderId` unique). Pas de multi-colis en MVP.
2. **CampaignInterest → Customer** : **rattachement obligatoire**. À la soumission d'un intérêt, find-or-create `Customer` par email ; `CampaignInterest.customerId` est non-nullable. La suppression/anonymisation RGPD (§24) agit sur le `Customer` indépendamment de ses commandes.
3. **Réservation de stock** : réservation **dès qu'un paiement existe** (`paymentStatus` = `PARTIALLY_PAID` ou `PAID`), pas dès `DRAFT`/`PENDING_PAYMENT` sans paiement. Libérée si la commande passe `CANCELLED`/`REFUNDED`.
4. **Devise** : **EUR uniquement** pour le MVP. Les colonnes `currency` restent dans le schéma (extensibilité future) mais aucune logique multi-devise n'est développée ; validations Zod/DTO peuvent forcer `"EUR"`.
5. **RBAC OPERATOR** : non tranché — proposition maintenue (pas d'accès `/settings` ni suppression) à confirmer avant Phase 4.
6. **Numéro de commande** : non tranché — proposition maintenue `{année}-{séquence}` (ex. `2026-0042`) via séquence Postgres annuelle, à confirmer avant Phase 4.
7. **Enums campagne** : **sans accents** en base (`COMMANDES_FERMEES`, `EXPEDITION`, `TERMINEE`), déjà appliqué dans le schéma Prisma. L'affichage accentué se fait côté i18n front.
8. **Email transactionnel** : **Resend** ou **SMTP** au choix (`NOTIFICATION_EMAIL_PROVIDER`), derrière l'interface `NotificationProvider` (pas de dépendance obligatoire au cœur, cf. §32) ; fallback console si aucun n'est configuré.

## 6. Endpoints REST (Phase 1 — proposition, versionnés `/api/v1`)

```http
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id                    # nom/dates — pas le statut (le prix vient du produit)
PATCH  /api/v1/campaigns/:id/status
DELETE /api/v1/campaigns/:id                    # ADMIN — en cours : refusé (400) si des CampaignInterest existent ; archive : suppression définitive avec ses demandes
POST   /api/v1/campaigns/:id/interests          # public, rate-limited — items: [{variantId, quantity}]
GET    /api/v1/campaigns/:id/statistics         # + ventilation par couleur (byVariant)

GET    /api/v1/products                         # public — inclut les variantes
POST   /api/v1/products                         # crée aussi la variante Standard ; slug facultatif (généré)
GET    /api/v1/products/:id                     # public
PATCH  /api/v1/products/:id
PATCH  /api/v1/products/:id/archive             # active=false, jamais de suppression réelle
POST   /api/v1/products/:id/variants            # {colorId} — ajoute une couleur de la palette
PATCH  /api/v1/products/:id/variants/:variantId # {active} — false retire la couleur (ou la laisse inactive si historique) ; Standard jamais désactivable

GET    /api/v1/colors                           # palette globale
POST   /api/v1/colors                           # ADMIN uniquement — {name, hex}
PATCH  /api/v1/colors/:id                       # ADMIN uniquement — nom/pastille/actif
DELETE /api/v1/colors/:id                       # ADMIN uniquement — refusé (400) si une variante l'utilise
POST   /api/v1/products/:id/photo               # multipart, stockage disque local (voir §8)

GET    /api/v1/customers
POST   /api/v1/customers                        # identité + addresses[] (jusqu'à 10)
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id                    # email, identité, téléphone, addresses[] : carnet synchronisé (avec id = mise à jour, sans id = création, absente = suppression) ; refusé (400) si le client est anonymisé ; audité sans valeurs (fieldsChanged)
POST   /api/v1/customers/:id/gdpr-export        # ADMIN uniquement
POST   /api/v1/customers/:id/gdpr-anonymize     # ADMIN uniquement

GET    /api/v1/orders
POST   /api/v1/orders                           # items: [{variantId, quantity}]
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id/status
POST   /api/v1/orders/:id/payments

GET    /api/v1/production/batches
POST   /api/v1/production/batches               # items: [{variantId, quantityPlanned}] ; reference facultative (défaut : nom-AAAAMMJJ, #1, #2… si doublon)
PATCH  /api/v1/production/batches/:id           # référence/notes/quantités prévues — PLANNED uniquement
POST   /api/v1/production/batches/:id/start
POST   /api/v1/production/batches/:id/complete
POST   /api/v1/production/batches/:id/decrement # {productionItemId, quantity?=1} — corrige un lot en cours (mouvement négatif)

GET    /api/v1/inventory                        # par produit : stock total + détail par variante
GET    /api/v1/inventory/:variantId/movements
POST   /api/v1/inventory/adjustments            # {variantId, quantity, reason}

GET    /api/v1/shipments
POST   /api/v1/shipments
PATCH  /api/v1/shipments/:id/status

GET    /api/v1/settings
PATCH  /api/v1/settings                         # ADMIN uniquement — voir §8
POST   /api/v1/settings/test-email              # ADMIN uniquement, throttlé
POST   /api/v1/settings/test-ntfy               # ADMIN uniquement, throttlé
GET    /api/v1/settings/templates                # liste les templates email éditables
PATCH  /api/v1/settings/templates/:template     # ADMIN uniquement — voir §8
DELETE /api/v1/settings/templates/:template     # ADMIN uniquement — réinitialise au défaut

GET    /api/v1/audit-logs

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

## 8. Paramètres admin (`AppSettings`) et upload de fichiers

Ajouté après la Phase 1 initiale (§21 — page `/settings`), au-delà de ce qui était prévu au départ.

**Configuration email/ntfy éditable depuis l'admin** — modèle `AppSettings` (une seule ligne, id
fixe `"singleton"`) : provider email (`console`/`resend`/`smtp`), clé Resend, host/port/secure/
user/password SMTP, adresse expéditeur, url/topic/auth ntfy. Les valeurs en base priment sur
`.env`, qui reste le bootstrap par défaut si rien n'est configuré en base
(`SettingsService.getEmailConfig()`/`getNtfyConfig()` fusionnent DB puis env à chaque envoi — pas
de cache au démarrage, un changement depuis `/settings` prend effet immédiatement). `GET /settings`
ne renvoie jamais un secret en clair, seulement des booléens "configuré" et les champs non
sensibles. `PATCH /settings` et les deux endpoints `test-*` sont restreints à `ADMIN` (identifiants
de messagerie = donnée sensible, même logique que le RGPD §24).

Pas d'OAuth réel pour "connecter Gmail/Outlook" : un vrai flux Google/Microsoft (projet Cloud,
écran de consentement validé, refresh tokens) est disproportionné pour ce projet self-hosted (§32).
À la place, deux boutons préremplissent juste l'hôte/port SMTP connus et expliquent comment générer
un mot de passe d'application — l'usage standard hors application tierce validée.

**Templates de notification éditables** — modèle `NotificationTemplateOverride` (une ligne par
`NotificationTemplate` personnalisé ; l'absence de ligne = le template par défaut codé en dur
s'applique). Les templates par défaut sont écrits en `{{placeholder}}` (substitution par regex au
rendu) plutôt qu'en template literals JS, pour être éditables tels quels depuis `/settings` — même
mécanisme pour le défaut et pour une surcharge, aucune distinction de traitement.
`GET /settings/templates` liste les 8 templates email (`ADMIN_ALERT` exclu : c'est une alerte push
ntfy, pas un email, elle ne passe jamais par `renderTemplate()`), avec sujet/corps effectifs,
`customized` et les placeholders détectés automatiquement. `PATCH`/`DELETE .../:template` sont
`ADMIN` uniquement et audités (`SETTINGS_UPDATED`).

**Photo produit uploadée** — `Product.imageUrl`/`Product.documentUrl` (`String?`). L'image passe
par un vrai upload (`POST /products/:id/photo`, multipart via `multer`, stockage disque local sous
`apps/api/uploads/products/`, servi en statique par `app.useStaticAssets`) ; le PDF de présentation
reste un simple champ URL texte (seule la photo a été demandée en upload). Pas de S3/Cloudinary —
cohérent avec §32. **Le dossier `uploads/` doit être un volume Docker persistant en production**
(voir `docs/deployment.md`), sinon son contenu est perdu à chaque rebuild d'image.

**Image/PDF de campagne** — même pattern que le produit : `Campaign.imageUrl` (`POST
/campaigns/:id/photo`, upload réel sous `apps/api/uploads/campaigns/`) et `Campaign.documentUrl`
(champ URL texte pour le PDF de présentation).

## 9. Points restants avant Phase 2

- RBAC `OPERATOR` : périmètre exact des restrictions (proposition §5.5 à confirmer).
- Format définitif du numéro de commande (proposition §5.6 à confirmer).
- Volume Docker persistant pour `apps/api/uploads/` en production — pas encore ajouté à
  `docker-compose.yml` (cf. §8).
