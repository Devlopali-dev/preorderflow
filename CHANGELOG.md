# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le projet suit
[SemVer](https://semver.org/lang/fr/) en `0.x` : une version unique pour tout le monorepo, le mineur
augmente pour une évolution fonctionnelle, un changement d'API ou une migration, le patch pour les
correctifs.

## [Non publié]

## [0.6.0] — 2026-09-30

### Ajouté

- **Décrémenter la production** : bouton −1 dans les actions d'un lot en cours et route
  `POST /production/batches/:id/decrement`. La correction retire des unités déjà déclarées produites
  par un mouvement de stock négatif (l'historique n'est jamais réécrit), tracée dans l'audit.

### Sécurité du stock

- La correction est refusée sur un lot planifié, terminé ou annulé, au-delà de la quantité produite,
  et si elle ferait passer le stock physique sous zéro. La baisse est atomique : des corrections
  simultanées ne peuvent pas retirer plus que la production.

## [0.5.0] — 2026-09-30

### Ajouté

- **Clients complets** : à la création comme à la modification, toutes les informations sont
  saisissables — email, identité, téléphone et carnet d'adresses (facturation et livraison, société,
  complément, téléphone). La modale de détail d'un client gagne un mode « Modifier » et affiche
  l'adresse complète.

### Modifié

- `POST /customers` accepte `addresses[]` ; `PATCH /customers/:id` accepte aussi `email` et
  `addresses[]` (carnet synchronisé en une transaction : adresses avec `id` mises à jour, sans `id`
  créées, absentes supprimées).
- Un client anonymisé n'est plus modifiable (400).
- L'audit de `PATCH /customers/:id` n'enregistre plus les valeurs modifiées (nom, email, adresses),
  seulement les champs touchés (`fieldsChanged`) : ce sont des données personnelles qui survivraient
  à une anonymisation.

## [0.4.0] — 2026-09-30

### Ajouté

- **Archives de campagnes** (terminées et annulées) : section repliée sur `/campaigns`, campagnes en
  lecture seule, **réactivation** (retour en brouillon) et **suppression définitive** avec leurs
  demandes de recensement et leurs fichiers (ADMIN, journalisée : `CAMPAIGN_REACTIVATED`,
  `CAMPAIGN_DELETED`).
- Nouvelle campagne : envoi des images et du PDF comme à l'édition, produits archivés signalés
  « archivé » et placés en fin de liste, réactivation du produit après confirmation.
- Palette de couleurs gérée depuis les modales de création et d'édition d'un produit.

### Modifié

- **Migration** `add_campaign_audit_actions` : deux nouvelles valeurs de l'enum `AuditAction`.
- La palette de couleurs quitte `/settings`.
- Les transitions `TERMINEE → DRAFT` et `ANNULEE → DRAFT` sont autorisées (réactivation).
- `DELETE /campaigns/:id` est réservée aux ADMIN. Sur une archive, elle supprime aussi les demandes de
  recensement ; sur une campagne en cours, elle reste refusée tant qu'il y en a.
- Modifier, ajouter ou retirer un aperçu, ou enregistrer un intérêt sur une campagne archivée est
  refusé (400).

### Corrigé

- La suite E2E ne se connecte qu'une fois par lancement : le login est limité à 10 par minute et la
  suite s'en approchait, ce qui la rendait instable.

## [0.3.0] — 2026-09-30

### Ajouté

- Expéditions groupées par statut, avec une colonne Actions pour passer au statut suivant (absente
  sur Delivered et Returned) et « Signaler un incident ».
- Référence de production automatique `nom-AAAAMMJJ`, suffixée `#1`, `#2`… en cas de doublon.
- Nouveau produit : champ description ; nouvelle campagne : dates de début et de fin.

### Modifié

- **Désactiver une couleur la retire** si elle ne porte aucun historique ; sinon elle reste inactive.
  La règle « au moins une variante active » disparaît : sans couleur, le produit retombe sur la
  variante Standard, qui ne se désactive jamais.
- Le slug d'un produit est généré depuis le nom (plus de champ Slug) ; le SKU se propose depuis le nom.
- Production : colonne Actions masquée sur les lots terminés. Produits : lignes de couleurs en retrait.
- `POST /production/batches` : `reference` devient facultative. `POST /products` : `slug` devient
  facultatif. `PATCH /products/:id/variants/:variantId` renvoie `{ removed, variant? }`.

### Corrigé

- Test E2E du portail client : il attend désormais le nouveau lien magique dans les logs au lieu de
  lire un ancien lien.

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
