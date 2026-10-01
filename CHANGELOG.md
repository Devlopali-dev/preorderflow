# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le projet suit
[SemVer](https://semver.org/lang/fr/) en `0.x` : une version unique pour tout le monorepo, le mineur
augmente pour une évolution fonctionnelle, un changement d'API ou une migration, le patch pour les
correctifs.

## [Non publié]

## [0.10.1] — 2026-10-01

### Modifié

- Statuts de commande affichés en français partout (Brouillon, En attente de paiement, Payée, En préparation,
  Prête à expédier, Expédiée, Livrée, Annulée, Remboursée) : groupes et rappel de la page commandes, modales,
  fiches client, espace client, intitulés des boutons (« Passer en préparation », « Marquer prête à
  expédier »…) et message de confirmation. Les codes de l'API (`PAID`, `SHIPPED`…) ne changent pas : ils
  restent les identifiants (ancres, requêtes). Les statuts d'expédition ne sont pas concernés.

## [0.10.0] — 2026-10-01

### Ajouté

- **Paiement en espèces** (`CASH`) en plus du manuel (Revolut), du virement et de Stripe.
- **Lien de paiement par campagne** (`Campaign.paymentLink`, facultatif) avec son QR code dans la modale de
  campagne. Une commande peut désormais viser une campagne d'origine (`Order.campaignId`, facultatif,
  choisie à la création) : le lien de la campagne prime sur `REVOLUT_PAYMENT_LINK`.
- **Espace client : « Payer maintenant ? »** sur une commande en brouillon.
  `POST /customer/me/orders/:id/pay-now` génère le règlement manuel (lien avec le montant attendu, QR code,
  consigne d'indiquer nom et prénom dans la remarque), met la commande en attente de paiement et prévient
  l'admin, sans doublon si on revient sur la page. `POST /customer/me/orders/:id/pay-later` prévient l'admin
  qu'un mail de validation est à envoyer. Refus (400) dès que la commande n'est plus à régler.

### Modifié

- Lien Revolut : la devise et le montant en **centimes** passent en paramètres
  (`?currency=EUR&amount=300` pour 3 €), au lieu du montant en chemin. Le lien du `.env` se termine par
  `amount=` (voir `.env.example`) ; un lien qui n'est pas `revolut.me` est utilisé tel quel.
- Termes de paiement en français partout (administration et espace client) : modes, statuts de règlement,
  statut de paiement d'une commande (« Non payée », « Payée »…).
- Le lien généré est stocké dans `metadata.paymentLink` (l'ancienne clé `revolutLink` reste lue).

## [0.9.0] — 2026-10-01

### Ajouté

- Une commande ne peut être livrée que si elle est payée (`paymentStatus = PAID`) : refus 400 par le
  statut comme par l'expédition, avant toute écriture.
- Page commandes : rappel en italique de l'ordre des statuts.
- Nouvelle commande : les produits archivés sont listés en fin de liste, en italique, non sélectionnables.

### Modifié

- Une commande livrée est en lecture seule : plus de remboursement (API, modale et tableau).
- Plus de boutons d'avancement en double : le pied de la modale ne propose que les étapes propres à la
  commande (en préparation, prête à expédier), le panneau Préparation que l'expédition. « Payée » passe par la
  confirmation du paiement, « expédiée » et « livrée » par l'expédition. La page `/orders/[id]` reçoit les
  mêmes actions de statut.
- Palette de base des couleurs : boutons à bascule. Un clic ajoute la couleur (cochée d'office, listée au-dessus
  du bouton de palette), un second la retire (supprimée, ou désactivée si un produit l'utilise). La liste du
  dessous ne montre plus que les couleurs hors palette de base.

## [0.8.0] — 2026-10-01

### Modifié (changement cassant)

- **Le prix n'est plus porté par la campagne** : `Product.price` est la source unique. Retrait de
  `Campaign.indicativePrice` et `Campaign.currency` (migrations `drop_campaign_indicative_price` et
  `drop_campaign_currency`). Les prix et devises de campagne existants sont perdus ; les lignes de commande
  gardent leur `unitPrice`.
- API : `POST /campaigns` et `PATCH /campaigns/:id` refusent `indicativePrice` (400, `forbidNonWhitelisted`).
  `GET /campaigns/:slug` renvoie `product.price` et `product.currency`.
- La page publique affiche « Prix indicatif » avec le prix du produit ; les modales et tableaux de
  campagnes n'ont plus de champ ni de colonne prix.

## [0.7.0] — 2026-10-01

### Ajouté

- Dashboard : la carte « Demandes de recensement » affiche aussi le nombre de personnes et d'exemplaires
  (`StatCard` accepte une `caption`). L'API expose `interestPeople` et `interestQuantity`.
- Seed de développement rejouable et complet (commandes, expéditions, couleurs, archives).

### Modifié

- Le compteur de recensement du dashboard ne compte que les campagnes actives ; une campagne archivée
  n'y entre plus.
- Modale d'une commande : les actions de statut passent en pied de modale, la section « Statut » vide
  disparaît. Les cartes du dashboard mènent au groupe exact de `/orders` (ancres `orders-<statut>`).
- Produits : choisir une couleur dans le select l'ajoute aussitôt ; une couleur créée dans la palette à la
  création d'un produit est cochée automatiquement.

### Corrigé

- Une commande annulée ou remboursée refuse la création et la confirmation d'un paiement (400, avant toute
  écriture : le paiement ne passe plus à « payé » sur une commande annulée). Son panneau de paiement est en
  lecture seule.
- Le retrait d'une variante est enfin visible dans le tableau des produits (la règle `.table tbody td`
  écrasait l'indentation Tailwind ; classe `.table-indent` du design system).

## [0.6.1] — 2026-10-01

### Corrigé

- **Erreur 500 sur `/campaigns` (et `/settings`) avec une ancienne session** : après une
  réinitialisation de la base, le cookie d'un admin disparu avait une signature valide, mais
  `GET /auth/me` plantait (« No AdminUser found »). Le même cookie faisait aussi échouer en 500 toute
  écriture auditée (clé étrangère), et un admin désactivé gardait son accès jusqu'à l'expiration du jeton.

### Modifié

- Le garde d'authentification vérifie en base, à chaque requête, que le compte admin existe et est
  actif (401 « Session invalide » sinon) et prend le rôle en base plutôt que celui du jeton : un admin
  rétrogradé perd ses droits immédiatement.
- Web : un 401 de l'API renvoie vers `/login` et efface le cookie périmé (route
  `/api/auth/session-expired`) au lieu de faire planter la page ; la page de connexion explique que la
  session n'est plus valide.

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
