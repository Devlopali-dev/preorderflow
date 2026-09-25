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

## Sauvegardes

- PostgreSQL : dump régulier (`pg_dump`) planifié en dehors de l'application — voir
  `docs/deployment/coolify.md` pour le cas Coolify.
- Aucune donnée n'est source de vérité côté Redis (uniquement jobs BullMQ) : pas de sauvegarde
  Redis nécessaire au-delà de la persistance par défaut.

## Coolify

Voir [`docs/deployment/coolify.md`](deployment/coolify.md).
