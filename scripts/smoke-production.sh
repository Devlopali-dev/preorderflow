#!/usr/bin/env bash
# Smoke test d'une stack de production (api + web) déjà démarrée : utilisé par la CI pour l'image construite
# (job docker-production).
#
# Usage : scripts/smoke-production.sh <arguments de `docker compose`>   (ex. -f docker-compose.prod.yml --env-file ci.env)
#
# Variables : SMOKE_API_URL (défaut http://localhost:3201), SMOKE_WEB_URL (défaut http://localhost:3200),
#             SMOKE_EXPECT_API_URL = URL d'API censée être figée dans le JavaScript du navigateur (défaut : SMOKE_API_URL).
set -euo pipefail

API="${SMOKE_API_URL:-http://localhost:3201}"
WEB="${SMOKE_WEB_URL:-http://localhost:3200}"
EXPECT_JS_URL="${SMOKE_EXPECT_API_URL:-$API}"
COMPOSE=(docker compose "$@")

step() { echo "▶ $*"; }

step "API : santé"
curl -sf "$API/health" > /dev/null

# Migrations appliquées au démarrage et moteur Prisma chargé : une vraie requête base répond 200.
step "API : requête base (migrations + moteur Prisma)"
curl -sf "$API/api/v1/campaigns" > /dev/null

# Rendu serveur de l'accueil : le serveur web appelle l'API par le réseau interne.
step "Web : accueil (rendu serveur)"
curl -sf "$WEB/" > /dev/null

# L'URL publique de l'API est figée dans le JavaScript du navigateur au build (NEXT_PUBLIC_API_URL).
step "Web : URL d'API figée dans le JavaScript ($EXPECT_JS_URL)"
"${COMPOSE[@]}" exec -T web sh -c "grep -rlqF '$EXPECT_JS_URL' apps/web/.next/static"

# Limites de débit actives en production : 10 tentatives par minute sur le login, la 12e est refusée.
step "API : limites de débit (429 au 12e login)"
code=""
for _ in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/v1/auth/login" \
    -H 'Content-Type: application/json' -d '{"email":"smoke@example.com","password":"mauvais"}')
done
if [ "$code" != "429" ]; then
  echo "✗ attendu 429 au 12e login, reçu $code"
  exit 1
fi

echo "✓ smoke test OK"
