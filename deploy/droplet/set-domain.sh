#!/usr/bin/env bash
# Serve the site on your own domain(s), with HTTPS for each.
#   set-domain.sh corpus365.com corpus365.in corpus365.co.in
# The first domain is the main address; www. versions and the other domains
# redirect to it. Point each domain's DNS A record (and www) at this server first.
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: $0 main-domain [other-domain ...]"; exit 1; }
cd /opt/corpus365

valid='^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'
hosts=()
for d in "$@"; do
  d=$(echo "$d" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*##; s#^www\.##')
  [[ "$d" =~ $valid ]] || { echo "not a domain: $d"; exit 1; }
  hosts+=("$d" "www.$d")
done
primary="${hosts[0]}"

ip=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
echo "This server: $ip"
for h in "${hosts[@]}"; do
  got=$(getent ahostsv4 "$h" | awk 'NR==1{print $1}')
  if [ "$got" = "$ip" ]; then echo "  OK   $h -> $got"; else echo "  WAIT $h -> ${got:-no record yet} (HTTPS for it starts once DNS points here)"; fi
done

set_var() { if grep -q "^$1=" .env; then sed -i "s#^$1=.*#$1=$2#" .env; else echo "$1=$2" >> .env; fi; }
set_var SITE_ADDRESS "\"${hosts[*]}\""
set_var PRIMARY_HOST "$primary"
set_var APP_URL "https://$primary"

git pull --quiet origin main || true
deploy/droplet/deploy.sh --force
docker compose -f deploy/droplet/docker-compose.yml --env-file .env up -d --force-recreate caddy
echo "Done. Main address: https://$primary (certificates are issued within a minute once DNS points here)"
