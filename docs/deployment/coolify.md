# Déploiement sur Coolify

PreOrderFlow se déploie comme **une seule application Docker Compose** : `docker-compose.coolify.yml` lance
PostgreSQL, Redis, l'API et le site web. Les migrations Prisma s'appliquent seules au démarrage de l'API.

## 1. Créer l'application

- **New Resource → Public / Private Repository** (GitHub), branche `main`.
- **Build Pack : Docker Compose**.
- **Docker Compose Location : `/docker-compose.coolify.yml`** (et non `docker-compose.yml`, réservé à l'usage
  local : il publie des ports sur l'hôte et lit un fichier `.env` qui n'existe pas dans le dépôt).

## 2. Domaines et HTTPS

Dans la configuration de l'application, un domaine **par service** (Coolify gère Traefik et Let's Encrypt) :

| Service | Exemple                     | Port |
| ------- | --------------------------- | ---- |
| `web`   | `https://app.mondomaine.fr` | 3000 |
| `api`   | `https://api.mondomaine.fr` | 3001 |

L'API doit avoir son propre domaine : le navigateur l'appelle directement (formulaires publics, panneau admin).

## 3. Variables d'environnement (onglet Environment Variables)

**Obligatoires** (le déploiement refuse de démarrer sans elles, avec un message explicite) :

| Variable                                                   | Valeur                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`        | identifiants de la base créée par le compose                           |
| `JWT_SECRET`, `MAGIC_LINK_SECRET`, `SESSION_COOKIE_SECRET` | trois secrets aléatoires distincts (`openssl rand -hex 32`)            |
| `WEB_URL`                                                  | URL publique du site : `https://app.mondomaine.fr` (liens des e-mails) |
| `CORS_ORIGIN`                                              | la même : `https://app.mondomaine.fr`                                  |
| `NEXT_PUBLIC_API_URL`                                      | URL publique de l'API : `https://api.mondomaine.fr`                    |

> `NEXT_PUBLIC_API_URL` est **figée dans le JavaScript du navigateur au build**. La cocher « Build Variable » est
> inutile (le compose la passe lui-même), mais la modifier exige un **nouveau déploiement**, pas un simple
> redémarrage.

**Facultatives** : `NOTIFICATION_EMAIL_PROVIDER` (`resend` ou `smtp`) avec `RESEND_API_KEY` / `SMTP_*` et
`EMAIL_FROM`, `REVOLUT_PAYMENT_LINK`, `STRIPE_*`, `PREORDERFLOW_NTFY_*`, `TURNSTILE_*`, `JWT_EXPIRES_IN`,
`MAGIC_LINK_EXPIRES_IN`. Sans fournisseur d'e-mail configuré, les e-mails sont seulement écrits dans les logs :
configurer le fournisseur avant d'ouvrir le site (ou depuis `/settings` après le premier lancement).

**Limites de débit.** Actives en production. `TRUST_PROXY` vaut `1` par défaut dans ce fichier (Traefik est le
seul proxy devant l'API) : ne le changer que si un autre proxy (CDN) s'ajoute devant Traefik. Ne **jamais**
définir `RATE_LIMIT_DISABLED=true` (il n'est d'ailleurs pas transmis au conteneur).

## 4. Premier lancement

1. Déployer. Au démarrage, l'API applique les migrations (`prisma migrate deploy`) : un échec arrête le
   conteneur et s'affiche dans les logs de l'API.
2. Ouvrir `https://app.mondomaine.fr` : tant qu'aucun compte n'existe, l'écran `/setup` permet de créer le
   premier administrateur. Il se ferme ensuite définitivement.
3. Renseigner l'e-mail et les notifications depuis `/settings`.

## 5. Mises à jour

Pousser sur `main` : Coolify reconstruit les images et redémarre. Les nouvelles migrations s'appliquent seules.
Ne jamais utiliser `migrate:dev` en production (il peut demander une réinitialisation de schéma).

## 6. Sauvegardes

Deux volumes contiennent des données à sauvegarder :

- `postgres_data` : la base. Ajouter dans Coolify une **Scheduled Task** quotidienne sur le service `postgres`
  (`pg_dump -U $POSTGRES_USER $POSTGRES_DB > /var/lib/postgresql/data/backup.sql`) et copier le dump hors du
  serveur (stockage S3-compatible recommandé). Alternative : utiliser une base **PostgreSQL gérée par Coolify**
  (avec ses sauvegardes intégrées) et retirer le service `postgres` du compose en renseignant `DATABASE_URL`.
- `api_uploads` : photos produit et aperçus de campagne (`apps/api/uploads/`). Sans ce volume, perdus à chaque
  redéploiement ; c'est un volume nommé du compose, il persiste.

## 7. Workers BullMQ

Si des jobs asynchrones sont ajoutés (notifications, exports), déployer un processus worker séparé (même image
`api`, commande différente, ex. `node dist/worker.js`) plutôt que de le lancer dans le processus HTTP principal.

## 8. Dépannage

| Symptôme                                              | Cause et remède                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Le déploiement échoue tout de suite avec `... requis` | Une variable obligatoire manque (voir §3).                                                                             |
| `port is already allocated`                           | Le mauvais fichier est utilisé : choisir `/docker-compose.coolify.yml` (aucun port publié).                            |
| L'API répond 500 sur tout / conteneur qui redémarre   | Lire les logs du service `api` : migrations en échec, ou base injoignable (`POSTGRES_*`).                              |
| Le site s'affiche mais les formulaires échouent       | `NEXT_PUBLIC_API_URL` ne pointe pas vers l'API publique (redéployer après correction), ou `CORS_ORIGIN` ≠ URL du site. |
| « Trop de requêtes » pour tout le monde               | `TRUST_PROXY` vide ou à `0` : l'API ne voit que l'adresse de Traefik (voir `docs/security.md`).                        |
