# Contribuer à PreOrderFlow

Merci de l'intérêt porté à ce projet. Ce document décrit comment proposer un changement.

## Process

1. Ouvrir une issue décrivant le bug ou la fonctionnalité avant de commencer un travail
   conséquent, pour valider l'approche.
2. Créer une branche depuis `main` : `feat/…`, `fix/…`, `docs/…`.
3. Développer en suivant les principes d'architecture décrits dans
   [`docs/architecture.md`](docs/architecture.md) et [`docs/contributing.md`](docs/contributing.md).
4. S'assurer que `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm test:e2e` passent.
5. Ouvrir une pull request vers `main` avec une description claire du changement et de sa
   motivation.

## Règles de conception à respecter

- Ne jamais fusionner les concepts du cycle métier
  (Intérêt / Commande / Paiement / Production / Stock / Préparation / Expédition / Livraison).
- Le stock est toujours dérivé de `InventoryMovement`, jamais stocké directement sur `Product`.
- Toute autorisation est vérifiée côté backend.

## Code de conduite

Ce projet suit le [Code de conduite](CODE_OF_CONDUCT.md).

## Sécurité

Pour signaler une vulnérabilité, voir [`SECURITY.md`](SECURITY.md) — ne pas ouvrir d'issue
publique pour une faille de sécurité.
