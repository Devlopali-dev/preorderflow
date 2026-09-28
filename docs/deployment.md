# Déploiement

## Docker Compose (auto-hébergé)

```bash
cp .env.example .env   # renseigner les valeurs de production
docker compose up -d --build
docker compose exec api pnpm --filter @preorderflow/database migrate
```

Services : `postgres`, `redis`, `api`, `web`, derrière un reverse-proxy (Traefik compatible — le
`docker-compose.yml` n'embarque pas Traefik lui-même, à ajouter selon l'infra cible via labels).

## Variables d'environnement critiques en production

- `JWT_SECRET`, `MAGIC_LINK_SECRET`, `SESSION_COOKIE_SECRET` : valeurs aléatoires longues, jamais
  celles de `.env.example`.
- `CORS_ORIGIN` : domaine exact du frontend, pas de wildcard.
- `DATABASE_URL` / `REDIS_URL` : pointer vers les instances managées de production.
- `RESEND_API_KEY` (ou provider SMTP alternatif) pour les emails transactionnels.

## Photos produit (`apps/api/uploads/`)

Les photos uploadées via `POST /products/:id/photo` sont stockées sur le disque du conteneur
`api` (pas de S3, cf. `docs/architecture.md` §8). **`apps/api/uploads/` doit être monté comme
volume Docker persistant** (ex. ajouter un volume nommé dans `docker-compose.yml` mappé sur ce
chemin) — à défaut, tout le contenu est perdu au prochain rebuild d'image. Ce volume n'est pas
encore présent dans `docker-compose.yml` fourni : à ajouter avant toute mise en production réelle
qui utiliserait l'upload de photo.

## Sauvegardes

- PostgreSQL : dump régulier (`pg_dump`) planifié en dehors de l'application — voir
  `docs/deployment/coolify.md` pour le cas Coolify.
- Aucune donnée n'est source de vérité côté Redis (uniquement jobs BullMQ) : pas de sauvegarde
  Redis nécessaire au-delà de la persistance par défaut.
- Volume `apps/api/uploads/` : à inclure dans la stratégie de sauvegarde si l'upload de photo est
  utilisé (aucune trace en base ne permet de reconstruire les fichiers perdus).

## Coolify

Voir [`docs/deployment/coolify.md`](deployment/coolify.md).
