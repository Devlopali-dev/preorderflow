# PreOrderFlow — Cahier des charges de développement

Tu es un développeur senior full-stack chargé de concevoir et développer une application open source appelée **PreOrderFlow**.

## 1. Objectif du projet

PreOrderFlow est une application web légère permettant à un fabricant/créateur de gérer le cycle complet d'une petite production :

**Recensement → Commandes → Paiements → Production → Stock → Préparation → Expédition → Livraison**

Le premier cas d'utilisation est la fabrication et la vente de **sifflets anti-agression**, mais l'application doit être générique et permettre de gérer n'importe quel produit fabriqué en petites séries.

L'application ne doit PAS être conçue comme un ERP généraliste.

Le concept fondamental est de séparer strictement :

- les personnes intéressées par un produit ;
- les commandes réelles ;
- la production ;
- le stock ;
- les expéditions.

Une prévision de demande n'est jamais une commande.

---

# 2. Stack technique obligatoire

Utilise cette stack sauf raison technique forte :

### Frontend

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod

### Backend

- NestJS
- TypeScript
- API REST
- Swagger/OpenAPI

### Base de données

- PostgreSQL
- Prisma ORM

### Jobs / tâches asynchrones

- Redis
- BullMQ

### Infrastructure

- Docker
- Docker Compose
- Traefik compatible
- déploiement compatible Coolify

### Tests

- Vitest pour les tests unitaires
- Playwright pour les tests E2E

### Qualité

- ESLint
- Prettier
- TypeScript strict
- Husky / lint-staged si pertinent

---

# 3. Architecture du repository

Utilise un monorepo :

```text
preorderflow/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── database/
│   ├── ui/
│   ├── types/
│   └── config/
│
├── docs/
│
├── docker/
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── CLAUDE.md
└── LICENSE
```

Utilise une organisation permettant d'ajouter ultérieurement :

- application mobile ;
- API publique ;
- MCP server ;
- intégrations Stripe ;
- intégrations transporteurs.

---

# 4. Principes d'architecture

Respecte impérativement les principes suivants.

## Séparation des domaines

Les domaines suivants doivent être indépendants :

```text
Campaign
Customer
Product
Interest
Order
Payment
Production
Inventory
Shipment
Notification
```

Ne crée pas un modèle monolithique "transaction".

---

# 5. Campagnes

Une campagne représente une opération commerciale.

Exemple :

```text
Sifflet anti-agression #1
```

Une campagne possède :

- id
- nom
- slug
- description
- statut
- date de début
- date de fin
- produit associé
- prix indicatif
- image
- paramètres de recensement
- timestamps

Statuts :

```text
DRAFT
RECENSEMENT
COMMANDES_OUVERTES
COMMANDES_FERMÉES
PRODUCTION
EXPÉDITION
TERMINEE
ANNULEE
```

---

# 6. Recensement

Une personne peut indiquer son intérêt pour un produit.

Exemple :

```text
Je souhaite 3 sifflets.
```

Cela ne crée PAS une commande.

Créer une entité :

```text
CampaignInterest
```

avec au minimum :

- id
- campaignId
- customerId nullable
- email
- firstName
- lastName
- phone nullable
- quantity
- comment nullable
- consentToContact
- createdAt
- updatedAt

Le formulaire public doit être accessible sans compte.

Il doit comporter une protection anti-spam.

---

# 7. Statistiques du recensement

Pour chaque campagne, afficher :

- nombre de personnes intéressées ;
- quantité totale demandée ;
- quantité moyenne ;
- distribution des quantités ;
- évolution dans le temps.

Exemple :

```text
184 personnes intéressées
327 sifflets demandés

1 exemplaire : 96
2 exemplaires : 54
3 exemplaires : 21
4 exemplaires : 8
5+ : 5
```

Ces statistiques doivent être calculées à partir des données et non stockées inutilement.

---

# 8. Produits

Créer une entité `Product`.

Champs minimum :

- id
- SKU
- name
- slug
- description
- price
- currency
- taxRate
- weight
- active
- manufacturable
- timestamps

Prévoir la possibilité d'ajouter plus tard des variantes.

---

# 9. Clients

Créer une entité `Customer`.

Champs :

- id
- email
- firstName
- lastName
- phone
- timestamps

Les adresses doivent être une entité séparée.

Créer :

```text
Address
```

avec :

- customerId
- type
- firstName
- lastName
- company nullable
- address1
- address2 nullable
- postalCode
- city
- country
- phone nullable

---

# 10. Commandes

Une commande est totalement indépendante d'un recensement.

Créer :

```text
Order
OrderItem
```

Une commande possède :

- numéro humain lisible
- customerId
- status
- paymentStatus
- fulfillmentStatus
- currency
- subtotal
- shippingAmount
- taxAmount
- total
- billingAddress
- shippingAddress
- notes
- timestamps

Statuts de commande :

```text
DRAFT
PENDING_PAYMENT
PAID
PROCESSING
READY_TO_SHIP
SHIPPED
DELIVERED
CANCELLED
REFUNDED
```

Les statuts doivent être validés par une machine à états afin d'empêcher les transitions incohérentes.

---

# 11. Paiements

Créer une entité séparée :

```text
Payment
```

Prévoir :

```text
MANUAL
BANK_TRANSFER
STRIPE
```

même si Stripe n'est pas implémenté dans le MVP.

Champs :

- id
- orderId
- provider
- providerReference nullable
- amount
- currency
- status
- paidAt
- metadata JSON
- timestamps

Statuts :

```text
PENDING
AUTHORIZED
PAID
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 12. Production

La production doit fonctionner par lots.

Créer :

```text
ProductionBatch
ProductionItem
```

Exemple :

```text
Production #2026-001

Produit :
Sifflet anti-agression

Prévu :
350

Fabriqué :
350

Statut :
COMPLETED
```

Statuts :

```text
PLANNED
IN_PROGRESS
PARTIALLY_COMPLETED
COMPLETED
CANCELLED
```

Une production terminée doit créer automatiquement les mouvements de stock correspondants.

---

# 13. Stock

NE PAS stocker uniquement un champ `product.stock`.

Le stock doit être calculé à partir de mouvements.

Créer :

```text
InventoryMovement
```

Types :

```text
PRODUCTION
ADJUSTMENT_IN
ADJUSTMENT_OUT
SALE
RETURN
DAMAGE
TRANSFER
```

Chaque mouvement possède :

- productId
- quantity
- type
- referenceType
- referenceId
- reason
- createdAt

Calculer :

```text
physicalStock
reservedStock
availableStock
```

avec :

```text
availableStock = physicalStock - reservedStock
```

Les réservations doivent être liées aux lignes de commande.

---

# 14. Exemple métier critique

Si :

```text
327 personnes intéressées
```

puis :

```text
301 commandes
```

et :

```text
350 produits fabriqués
```

le système doit afficher :

```text
Prévisions       327
Commandes        301
Production       350
Stock physique   350
```

Il ne faut jamais confondre ces valeurs.

---

# 15. Préparation des commandes

Créer un workflow de fulfillment.

Une commande payée peut devenir :

```text
PROCESSING
```

puis :

```text
READY_TO_SHIP
```

L'opérateur doit pouvoir voir :

```text
Commande #2026-0042

Jean Dupont

3 × Sifflet anti-agression

Adresse de livraison

[Marquer comme préparée]
```

Prévoir plus tard des listes de picking.

---

# 16. Expéditions

Créer :

```text
Shipment
ShipmentEvent
```

Shipment :

- id
- orderId
- carrier
- trackingNumber
- trackingUrl
- status
- shippedAt
- deliveredAt
- weight
- metadata

Statuts :

```text
PENDING
LABEL_CREATED
SHIPPED
IN_TRANSIT
OUT_FOR_DELIVERY
DELIVERED
EXCEPTION
RETURNED
```

Les événements de transport doivent être conservés.

---

# 17. Notifications

Créer un système générique de notifications.

Canaux :

```text
EMAIL
```

Prévoir ultérieurement :

```text
SMS
WEBHOOK
```

Templates :

```text
INTEREST_REGISTERED
ORDERS_OPENED
ORDER_CREATED
PAYMENT_RECEIVED
ORDER_READY
ORDER_SHIPPED
ORDER_DELIVERED
```

Utiliser des templates configurables.

---

# 18. Dashboard

Créer un dashboard administrateur.

Afficher :

```text
Campagnes actives
Demandes de recensement
Commandes
Commandes à payer
Commandes à préparer
Commandes à expédier
Production en cours
Stock
Livraisons
```

Pour une campagne :

```text
Demandes        327
Personnes       184

Commandes       301
Produits        327

Production      350
En stock        350

Expédiés        287
Livrés          280
```

---

# 19. Interface publique

Créer une interface publique moderne et responsive.

Page campagne :

```text
Sifflet anti-agression

Description

Prix indicatif : 5 €

Combien souhaitez-vous en obtenir ?

[-]  2 [+]

Email
[................]

Nom
[................]

[Je participe au recensement]
```

Afficher clairement :

> Le recensement ne constitue pas une commande et ne vous engage pas à acheter.

---

# 20. Interface client

Pas de mot de passe obligatoire dans le MVP.

Utiliser un système de magic link.

Le client peut :

- consulter ses commandes ;
- consulter leur statut ;
- consulter son paiement ;
- consulter son expédition ;
- consulter son numéro de suivi ;
- modifier ses informations avant expédition.

---

# 21. Interface administrateur

Créer les pages :

```text
/dashboard

/campaigns
/campaigns/:id

/products
/products/:id

/customers
/customers/:id

/orders
/orders/:id

/payments

/production
/production/:id

/inventory

/shipments
/shipments/:id

/settings
```

Utiliser une interface claire et professionnelle.

---

# 22. API REST

Documenter toute l'API avec Swagger.

Prévoir notamment :

```http
GET /api/campaigns
POST /api/campaigns

GET /api/campaigns/:id
POST /api/campaigns/:id/interests

GET /api/campaigns/:id/statistics

GET /api/products
POST /api/products

GET /api/orders
POST /api/orders
GET /api/orders/:id

POST /api/orders/:id/payments

GET /api/production/batches
POST /api/production/batches
POST /api/production/batches/:id/start
POST /api/production/batches/:id/complete

GET /api/inventory

GET /api/shipments
POST /api/shipments

POST /api/webhooks/stripe
POST /api/webhooks/shipping
```

---

# 23. Authentification et autorisation

Administrateurs :

- email/password
- sessions sécurisées
- RBAC

Rôles :

```text
ADMIN
OPERATOR
```

Clients :

- magic links
- aucune possibilité d'accéder aux données d'un autre client

Toutes les routes sensibles doivent être protégées côté backend.

Ne jamais faire confiance aux permissions du frontend.

---

# 24. RGPD

Prévoir dès la V1 :

- export des données client ;
- suppression/anonymisation ;
- consentement ;
- politique de confidentialité ;
- journalisation ;
- minimisation des données ;
- durée de conservation configurable.

Les données du recensement doivent pouvoir être supprimées/anonymisées indépendamment des commandes.

---

# 25. Audit log

Créer :

```text
AuditLog
```

Enregistrer les actions administratives importantes :

```text
ORDER_CREATED
ORDER_CANCELLED
PAYMENT_CONFIRMED
PRODUCTION_STARTED
PRODUCTION_COMPLETED
INVENTORY_ADJUSTED
SHIPMENT_CREATED
SHIPMENT_UPDATED
CUSTOMER_UPDATED
```

Avec :

- userId
- action
- entityType
- entityId
- metadata
- timestamp

---

# 26. Sécurité

Implémenter :

- validation Zod côté frontend ;
- validation DTO côté NestJS ;
- rate limiting ;
- protection brute-force ;
- anti-spam ;
- headers de sécurité ;
- CORS strict ;
- cookies sécurisés ;
- secrets uniquement dans `.env` ;
- logs sans données sensibles ;
- SQL toujours via Prisma ;
- contrôle d'autorisation côté backend.

---

# 27. Docker

Fournir :

```text
docker-compose.yml
docker-compose.dev.yml
```

Services :

```text
web
api
postgres
redis
```

Le système doit démarrer avec :

```bash
docker compose up -d
```

Prévoir :

```text
.env.example
```

---

# 28. Coolify

Le projet doit être compatible avec Coolify.

Documenter dans :

```text
docs/deployment/coolify.md
```

La documentation doit expliquer :

- création PostgreSQL ;
- création Redis ;
- variables d'environnement ;
- domaine ;
- HTTPS ;
- migrations Prisma ;
- backups ;
- workers BullMQ.

---

# 29. Tests

Écrire des tests dès le développement.

Tests unitaires :

- calcul stock ;
- calcul quantité ;
- transitions de statuts ;
- calcul total commande ;
- calcul statistiques campagne.

Tests E2E :

### Scénario 1

```text
Créer campagne
↓
Publier campagne
↓
Créer intérêt
↓
Vérifier statistiques
```

### Scénario 2

```text
Créer commande
↓
Payer
↓
Créer production
↓
Terminer production
↓
Vérifier stock
```

### Scénario 3

```text
Commande payée
↓
Préparation
↓
Expédition
↓
Tracking
↓
Livraison
```

---

# 30. Seed de développement

Créer un seed PostgreSQL permettant de démarrer avec :

```text
1 administrateur
2 opérateurs

3 produits

2 campagnes

10 clients

20 intérêts

10 commandes

1 lot de production

100 produits en stock

5 expéditions
```

---

# 31. Documentation

Créer :

```text
README.md

docs/
├── architecture.md
├── database.md
├── api.md
├── deployment.md
├── coolify.md
├── development.md
├── security.md
└── contributing.md
```

Le README doit permettre à un développeur de :

```bash
git clone ...
cp .env.example .env
docker compose up -d
```

et accéder immédiatement à l'application.

---

# 32. Open source

Licence :

```text
AGPL-3.0
```

Ajouter :

```text
LICENSE
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
```

Ne jamais ajouter de dépendance propriétaire obligatoire au fonctionnement du cœur de l'application.

---

# 33. Préparer l'extensibilité

L'architecture doit permettre d'ajouter plus tard :

### Paiement

```text
Stripe
```

### Transport

```text
Colissimo
Mondial Relay
Chronopost
```

### Emails

```text
SMTP
Resend
Brevo
```

### Stock

```text
multi-entrepôts
```

### Production

```text
BOM
matières premières
coûts
```

### API

API publique versionnée :

```text
/api/v1/
```

---

# 34. MCP futur

Préparer l'architecture afin qu'un MCP server puisse être ajouté ultérieurement.

Le MCP devra pouvoir exposer des opérations en lecture telles que :

```text
get_campaign_statistics
get_order_statistics
get_low_stock_products
get_pending_orders
get_production_status
get_shipments_status
```

Exemples d'utilisation futurs :

> Combien de sifflets sont actuellement commandés ?

> Combien dois-je encore fabriquer ?

> Quelles commandes ne sont pas encore expédiées ?

> Quels produits sont en rupture ?

Ne pas implémenter le MCP dans le MVP, mais ne pas concevoir l'API de manière incompatible avec celui-ci.

---

# 35. Méthode de développement

NE PAS essayer de développer toute l'application en une seule étape.

Procéder par phases.

## Phase 1 — Architecture

Avant d'écrire le code :

1. analyser ce cahier des charges ;
2. proposer l'arborescence ;
3. proposer le modèle de données ;
4. proposer les relations ;
5. identifier les ambiguïtés ;
6. produire `docs/architecture.md` ;
7. produire le schéma Prisma.

Puis attendre validation.

## Phase 2 — Infrastructure

Implémenter :

- monorepo ;
- Docker ;
- PostgreSQL ;
- Redis ;
- Prisma ;
- NestJS ;
- Next.js ;
- CI ;
- tests.

## Phase 3 — Campagnes et recensement

Implémenter complètement :

- campagne ;
- formulaire public ;
- intérêts ;
- statistiques ;
- administration.

## Phase 4 — Commandes

Implémenter :

- clients ;
- commandes ;
- lignes ;
- adresses ;
- statuts ;
- dashboard.

## Phase 5 — Paiements

Commencer par :

- paiement manuel ;
- virement.

Préparer Stripe sans le rendre obligatoire.

## Phase 6 — Production et stock

Implémenter :

- lots de production ;
- mouvements de stock ;
- stock disponible ;
- stock réservé.

## Phase 7 — Fulfillment

Implémenter :

- préparation ;
- expédition ;
- tracking ;
- livraison manuelle.

## Phase 8 — Notifications

Implémenter les emails transactionnels.

## Phase 9 — Tests

Créer une suite E2E complète.

## Phase 10 — Documentation et déploiement

Finaliser :

- Docker ;
- Coolify ;
- sauvegardes ;
- documentation ;
- sécurité ;
- README.

---

# 36. Règles importantes pour le développement

Tu dois :

- privilégier la simplicité ;
- éviter le sur-engineering ;
- ne pas créer de microservices ;
- garder PostgreSQL comme source de vérité ;
- utiliser des transactions SQL pour les opérations critiques ;
- utiliser des UUID ;
- utiliser UTC en base de données ;
- utiliser les migrations Prisma ;
- ne jamais modifier directement la base en production ;
- ne jamais stocker de données calculées lorsqu'elles peuvent être dérivées de données fiables ;
- écrire des tests pour les règles métier ;
- ne pas mettre la logique métier uniquement dans React ;
- garder le backend responsable des règles métier.

---

# 37. Règle fondamentale

Avant chaque implémentation importante, vérifie que le workflow reste cohérent :

```text
INTÉRÊT
   ↓
COMMANDE
   ↓
PAIEMENT
   ↓
PRODUCTION
   ↓
STOCK
   ↓
PRÉPARATION
   ↓
EXPÉDITION
   ↓
LIVRAISON
```

Ne jamais fusionner ces concepts.

---

# 38. Première tâche

Commence UNIQUEMENT par la phase 1.

Ne développe pas encore toute l'application.

Tu dois :

1. analyser le cahier des charges ;
2. proposer l'architecture du monorepo ;
3. proposer le schéma PostgreSQL/Prisma complet ;
4. proposer les machines à états ;
5. identifier les éventuels problèmes de conception ;
6. proposer les endpoints REST ;
7. proposer le plan de développement par commits ;
8. produire les fichiers de documentation d'architecture.

Ne passe pas à l'implémentation fonctionnelle avant d'avoir terminé cette analyse.

Lorsque la phase 1 est terminée, présente-moi :

- l'architecture ;
- le schéma de données ;
- les workflows ;
- les éventuels points à valider ;

puis attends mes instructions avant de commencer la phase 2.