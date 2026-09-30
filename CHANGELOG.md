# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le projet suit
[SemVer](https://semver.org/lang/fr/) en `0.x` : une version unique pour tout le monorepo, le mineur
augmente pour une évolution fonctionnelle, un changement d'API ou une migration, le patch pour les
correctifs.

## [Non publié]

## [0.2.0] — 2026-09-30

### Ajouté

- **Variantes de produit (couleurs)** : chaque couleur d'un produit est une variante avec son stock,
  sa production, ses commandes et ses demandes de recensement. Palette globale de couleurs.
- Recensement public avec une quantité par couleur ; statistiques de campagne ventilées par couleur
  (`byVariant`).
- Page produits : produits actifs et archivés, détail du stock par couleur, envoi de la photo,
  choix des couleurs à la création, couleurs inactives signalées.
- Palette de base de 16 couleurs, suppression d'une couleur (refusée si une variante l'utilise).
- Page de setup pour créer le premier compte admin.

### Modifié

- **Changement d'API** : `POST /orders`, `/production/batches`, `/campaigns/:id/interests` et
  `/inventory/adjustments` prennent `variantId` à la place de `productId`.
- **Migration** `add_product_variants` : une variante par défaut est créée pour chaque produit
  existant, puis stock, production, commandes et intérêts passent à `variantId` sans perte.
- Slug généré depuis le nom à la création d'une campagne ou d'un produit.

### Corrigé

- Numéro de commande unique sous création concurrente (verrou consultatif Postgres).
- Stack Docker : l'API vise `postgres` et `redis` par nom de service dans le conteneur.
- Tests E2E fiables en parallèle et avec la stack Docker, indépendants de l'état des variantes du seed.

## [0.1.0] — 2026-09-28

Première version fonctionnelle : campagnes et recensement, clients, commandes et machine à états,
paiements (manuel, virement, Stripe), production par lots, stock calculé à partir de mouvements,
expéditions et suivi, notifications par email, authentification admin (RBAC) et magic link client,
RGPD (export, anonymisation), journal d'audit, paramètres (email, ntfy, templates), Docker.
