#!/usr/bin/env bash
# Deploys the latest `main` if it changed (or always with --force):
# pull → build → migrate + bootstrap → restart. Safe to run from cron.
set -euo pipefail
cd /opt/corpus365
exec 9>/var/lock/corpus365-deploy.lock
flock -n 9 || { echo "deploy already running"; exit 0; }

git fetch --quiet origin main
if [[ "${1:-}" != "--force" && "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
  exit 0
fi
git reset --quiet --hard origin/main
echo "$(date -Is) deploying $(git rev-parse --short HEAD)"

COMPOSE="docker compose -f deploy/droplet/docker-compose.yml --env-file .env"
$COMPOSE build app
$COMPOSE up -d db
# Upgrade the schema before the new code takes traffic; a failure keeps the old version running.
$COMPOSE run --rm --no-deps app sh -c "node dist/migrate.cjs && node dist/bootstrap.cjs"
$COMPOSE up -d --remove-orphans
docker image prune -f >/dev/null
echo "$(date -Is) deployed"
