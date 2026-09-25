# Contribuer

Voir aussi [`CONTRIBUTING.md`](../CONTRIBUTING.md) à la racine pour le process complet
(issues, branches, pull requests, code de conduite).

## Principes de code

- Simplicité avant tout : pas de sur-ingénierie, pas de microservices, pas d'abstraction
  prématurée.
- La logique métier vit dans `apps/api`, jamais uniquement côté frontend.
- Toute opération critique (paiement, transition de statut, mouvement de stock) passe par une
  transaction SQL Prisma.
- Un changement de statut (commande, campagne, production, expédition) passe toujours par la
  machine à états dédiée — jamais un `update({ status })` direct.

## Avant une pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Convention de commits

Préfixes `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:` suivis d'une description courte
au présent (voir l'historique git pour des exemples).
