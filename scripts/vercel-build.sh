#!/usr/bin/env bash
# Vercel build: on production deploys, upgrade the database first so new code
# never runs against an old schema; then build the app. If the migration fails,
# the build fails and the previous version keeps serving.
set -euo pipefail

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is not set. Connect a Neon database in Vercel → Storage first." >&2
    exit 1
  fi
  npm run db:migrate
  npm run db:bootstrap
fi

npx next build
