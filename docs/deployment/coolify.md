# Déploiement sur Coolify

## 1. Base de données PostgreSQL

- Dans Coolify : **New Resource → Database → PostgreSQL**.
- Noter l'URL de connexion interne fournie par Coolify → `DATABASE_URL`.
- Activer les sauvegardes automatiques (onglet Backups de la ressource) — quotidiennes minimum.

## 2. Redis

- **New Resource → Database → Redis**.
- Noter l'URL interne → `REDIS_URL`.

## 3. Applications

Créer deux applications à partir du même dépôt Git :

- **api** : Dockerfile `docker/api.Dockerfile`, port interne `3001`.
- **web** : Dockerfile `docker/web.Dockerfile`, port interne `3000`.

## 4. Variables d'environnement

Renseigner sur chaque application les variables de `.env.example` pertinentes (voir
`docs/deployment.md` pour les valeurs critiques). `DATABASE_URL` et `REDIS_URL` pointent vers les
ressources internes Coolify créées aux étapes 1 et 2.

## 5. Domaine et HTTPS

- Associer un domaine à l'application `web` (ex. `app.mondomaine.fr`) et un sous-domaine à `api`
  (ex. `api.mondomaine.fr`).
- Coolify gère automatiquement le certificat Let's Encrypt via Traefik dès qu'un domaine est
  attaché — aucune configuration Traefik manuelle nécessaire.
- Mettre à jour `CORS_ORIGIN` (côté api) et `NEXT_PUBLIC_API_URL` (côté web) avec les domaines
  définitifs, puis redéployer.

## 6. Migrations Prisma

Après chaque déploiement de l'application `api`, exécuter la migration via le terminal Coolify de
l'application (ou une commande de déploiement post-build) :

```bash
pnpm --filter @preorderflow/database migrate
```

Ne jamais utiliser `migrate:dev` en production (il peut demander une réinitialisation de schéma).

## 7. Sauvegardes

- PostgreSQL : backups automatiques Coolify (onglet Backups), export régulier vers un stockage
  externe (S3-compatible) recommandé pour la rétention long terme.
- Photos produit (`POST /products/:id/photo`, stockées dans `apps/api/uploads/products/` sur
  disque local du conteneur `api`) : monter un volume persistant Coolify sur ce chemin (onglet
  Storages de l'application `api`), sinon perdu à chaque redéploiement. Alternative : migrer vers
  un stockage objet (non implémenté à ce jour, cf. `docs/architecture.md` §8).

## 8. Workers BullMQ

Si des jobs asynchrones sont ajoutés (notifications, exports), déployer un processus worker séparé
(même image `api`, commande différente, ex. `node dist/worker.js`) plutôt que de le lancer dans le
processus HTTP principal.
