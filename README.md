# PreOrderFlow

Application open source pour gérer le cycle complet d'une petite production :
**Recensement → Commandes → Paiements → Production → Stock → Préparation → Expédition → Livraison**.

Premier cas d'usage : fabrication et vente de sifflets anti-agression — mais l'application est
générique et peut gérer n'importe quel produit fabriqué en petites séries.

## Démarrage rapide

```bash
git clone <url-du-repo>
cd preorderflow
cp .env.example .env
docker compose up -d
```

- Web : http://localhost:3000
- API : http://localhost:3001/api/v1
- Swagger : http://localhost:3001/api/docs

Pour peupler la base avec des données de démo :

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

## Stack

Next.js (App Router) + NestJS + PostgreSQL/Prisma + Redis/BullMQ, en monorepo pnpm.
Détails complets dans [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Modèle de données](docs/database.md)
- [API](docs/api.md)
- [Développement](docs/development.md)
- [Sécurité](docs/security.md)
- [Déploiement](docs/deployment.md) · [Coolify](docs/deployment/coolify.md)
- [Contribuer](CONTRIBUTING.md)

## Licence

AGPL-3.0 — voir [LICENSE](LICENSE).
