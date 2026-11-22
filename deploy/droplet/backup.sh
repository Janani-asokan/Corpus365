#!/usr/bin/env bash
# Nightly logical backup of the database, kept for 7 days on the server.
# For off-server copies, enable DigitalOcean Droplet backups or copy these files elsewhere.
set -euo pipefail
dir=/var/backups/corpus365
mkdir -p "$dir"
docker compose -f /opt/corpus365/deploy/droplet/docker-compose.yml --env-file /opt/corpus365/.env \
  exec -T db pg_dump -U corpus -d corpus365 --format=custom > "$dir/corpus365-$(date +%F).dump"
find "$dir" -name '*.dump' -mtime +7 -delete
