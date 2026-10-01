# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le projet suit
[SemVer](https://semver.org/lang/fr/) en `0.x` : une version unique pour tout le monorepo, le mineur
augmente pour une évolution fonctionnelle, un changement d'API ou une migration, le patch pour les
correctifs.

## [Non publié]

## [0.16.0] — 2026-10-01

### Ajouté

- **L'adresse saisie par le client remonte dans l'admin.** Une commande publique enregistre l'adresse dans le
  carnet du client (livraison et facturation) quand il n'en a encore aucune ; un client qui a déjà un carnet
  n'est jamais modifié par un formulaire anonyme (n'importe qui peut saisir son email).
- Espace client : section « Adresse de livraison » dans le profil (`PUT /customer/me/address`), préremplie et
  mise à jour sans doublon ; une facturation identique est créée si elle manque. Le profil renvoie les adresses.

### Corrigé

- Les fichiers uploadés (photos de produit, aperçus de campagne) n'étaient jamais supprimés quand l'API était
  lancée depuis un autre dossier que `apps/api` (CI, déploiement) : le dossier d'`uploads` est maintenant
  ancré sur l'emplacement du code.

## [0.15.1] — 2026-10-01

### Ajouté

- **Nettoyage des données de test E2E.** `pnpm db:clean-e2e` (`--dry-run` pour simuler) supprime ce que la
  suite Playwright laisse dans la base de dev : produits et campagnes à horodatage de test, clients
  `@example.com` hors clients de démo et leurs commandes, lots de production, couleurs temporaires,
  notifications, audit des comptes de démo et fichiers uploadés orphelins. Le jeu de démo et les données
  réelles sont épargnés.
- La suite lance ce nettoyage seule en fin de passage (`globalTeardown`) ; `E2E_KEEP_DATA=1` garde les données.

### Corrigé

- La base de dev grossissait à chaque passage de la suite (centaines de produits, commandes à 1 Mo), ce qui
  faisait dépasser leur délai à des tests au hasard.

## [0.15.0] — 2026-10-01

### Modifié

- **Une campagne en brouillon est invisible du public.** L'API l'exclut de la liste publique, de sa fiche et de
  ses statistiques pour un visiteur (404, jamais 403 : on ne confirme pas son existence) et refuse son
  recensement et sa commande publics. Un administrateur connecté la voit toujours : sa page publique est alors
  un aperçu, sans formulaire. Dès son passage en recensement, la campagne devient publique.
- Les routes publiques reconnaissent un administrateur connecté quand il fournit un jeton valide (compte actif
  vérifié en base) ; un jeton absent, invalide, expiré ou d'un client laisse la requête anonyme, sans erreur.
- Le serveur MCP lit les statistiques de campagne avec son jeton (une campagne en brouillon n'est plus lisible
  anonymement).

## [0.14.0] — 2026-10-01

### Ajouté

- **La page publique d'une campagne suit son statut.** En recensement (et brouillon), le formulaire de
  recensement reste tel quel. Quand les commandes sont **ouvertes**, il devient un formulaire d'**achat** :
  couleurs et quantités, sous-total, adresse de livraison, bouton « Commander ». Au-delà (commandes
  fermées, production, expédition, archives), plus de formulaire : un message « commandes fermées ».
- `POST /campaigns/:id/orders` (public, limité à 5 par minute, honeypot anti-spam) crée une vraie commande
  liée à la campagne puis son règlement manuel. Il refuse (400) tant que les commandes ne sont pas ouvertes
  ou si une couleur n'est pas celle du produit de la campagne, et ne réécrit jamais la fiche d'un client
  existant (même email).
- Après la commande, le client voit son numéro, le montant, le lien Revolut (celui de la campagne, sinon du
  `.env`) avec son QR code, et la consigne d'indiquer ses nom et prénom dans la remarque du paiement. La
  commande reste en attente de paiement, vérifiée à la main.

### Modifié

- Le sélecteur de quantités par couleur est partagé entre les formulaires de recensement et d'achat.

## [0.13.0] — 2026-10-01

### Ajouté

- **Passage automatique des campagnes selon leurs dates.** À partir de la date de début, une campagne en
  brouillon ou en recensement passe en « commandes ouvertes » ; après la date de fin, une campagne en
  brouillon, en recensement ou aux commandes ouvertes passe en « commandes fermées » (la fermeture l'emporte
  quand les deux dates sont dépassées). La production, l'expédition et les archives ne sont jamais touchées,
  ni une campagne sans date. La date de fin saisie sans heure est incluse : la campagne se ferme à la fin de ce
  jour-là (en UTC).
- Un planificateur dans l'API applique la règle au démarrage puis toutes les minutes
  (`CAMPAIGN_SCHEDULE_INTERVAL_MS`, coupé par `CAMPAIGN_SCHEDULE_DISABLED=true`). Chaque changement est
  conditionné à l'ancien statut, journalisé et notifié à l'admin.
- `POST /campaigns/apply-schedule` (ADMIN) déclenche le passage à la demande et renvoie les campagnes modifiées.
- Les modales de campagne indiquent ce passage automatique sous les dates.

## [0.12.2] — 2026-10-01

### Modifié

- Campagne (création et édition) : un seul champ « Ajouter une image ou un PDF » au lieu de deux. Images et
  PDF se choisissent ensemble, chaque fichier étant dirigé selon son type. À la création, un second PDF est
  écarté avec un message (un seul PDF par campagne) et le total reste limité à 5 aperçus.

## [0.12.1] — 2026-10-01

### Modifié

- Nouvelle campagne : les images et le PDF choisis s'affichent en petits aperçus sur une seule ligne, avec
  un bouton « Retirer » dessous, comme pour un nouveau produit. Les images s'ajoutent au fil des sélections
  (5 aperçus au maximum, images et PDF confondus : le surplus est écarté avec un message). Le PDF est
  représenté par une vignette « PDF » avec son nom, la vraie miniature n'étant générée par le serveur
  qu'à l'envoi.

## [0.12.0] — 2026-10-01

### Modifié

- **Nouveau produit : couleurs choisies par clic sur la palette.** Plus de cases à cocher : un clic sur une
  couleur l'ajoute aux « couleurs proposées » (affichées au-dessus du bouton de palette), un second la retire.
  Une couleur absente de la base est créée au premier clic, une couleur désactivée est réactivée. La liste
  « Désactiver / Supprimer » n'apparaît plus à la création : elle reste dans la modale d'un produit existant,
  pour les couleurs hors palette de base. La palette est bloquée tant que la liste des couleurs n'est pas chargée.
- La modale « Nouveau produit » est plus large (`xl`) pour que tout son contenu tienne.

### Corrigé

- API : délai de keep-alive du serveur HTTP porté à 65 s (5 s par défaut dans Node). Une connexion réutilisée
  au moment où le serveur la fermait échouait en « socket hang up », et peut produire des 502 derrière un
  reverse proxy (Traefik).

## [0.11.1] — 2026-10-01

### Modifié

- Photos d'un produit : petits aperçus sur une seule ligne, avec le bouton « Retirer » (création) ou
  « Supprimer » (édition) sous chaque image. À la création, les photos choisies s'affichent en aperçu au lieu
  d'un nom de fichier.

## [0.11.0] — 2026-10-01

### Ajouté

- **Jusqu'à 3 photos par produit**, dès la création : la modale « Nouveau produit » accepte plusieurs
  fichiers (3 retenus au plus, les autres sont écartés avec un message, chaque photo peut être retirée avant
  la création). La modale d'édition affiche la galerie, permet de supprimer une photo et d'en ajouter tant
  qu'il reste de la place. L'API refuse la 4ᵉ photo (400) et ne laisse pas de fichier orphelin.
- `DELETE /products/:id/photos/:photoId` retire la photo, efface son fichier et renumérote les suivantes.

### Modifié (changement cassant)

- `Product.imageUrl` est remplacé par `ProductPhoto` (migration `product_photos` : la photo existante devient
  la photo principale). Les produits exposent `photos: [{ id, url, position }]` ; `imageUrl` n'est plus accepté
  à la création ni à la mise à jour (400, `forbidNonWhitelisted`).

## [0.10.2] — 2026-10-01

### Modifié

- Statuts d'expédition affichés en français (En attente, Étiquette créée, Expédié, En transit, En cours de
  livraison, Livré, Incident, Retourné) : groupes de la page expéditions, boutons (« Marquer expédié »,
  « Signaler un incident »…), message de confirmation, panneau Préparation et espace client. Les codes de
  l'API ne changent pas.

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
