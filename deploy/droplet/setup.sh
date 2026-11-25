#!/usr/bin/env bash
# First-boot setup for an Ubuntu 24.04 Droplet. Expects ADMIN_EMAIL.
# While it runs, http://<server>/status.txt shows progress (step names only,
# never secrets), so a failure can be diagnosed from outside.
set -euo pipefail
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
cd /opt/corpus365
PUB=/var/lib/corpus365/public
mkdir -p "$PUB"

step() { echo "$(date -u +%FT%TZ) $*" | tee -a "$PUB/status.txt"; }
status_server_start() { (cd "$PUB" && nohup python3 -m http.server 80 >/dev/null 2>&1 &); }
status_server_stop() { pkill -f "http.server 80" || true; }
on_error() {
  step "FAILED at setup.sh line $1 (see /var/log/cloud-init-output.log on the server)"
  status_server_stop; status_server_start
}
trap 'on_error $LINENO' ERR

export DEBIAN_FRONTEND=noninteractive
step "installing firewall"
apt-get install -y ufw
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
status_server_start
step "setup started"

step "installing docker"
apt-get install -y docker.io docker-compose-v2 docker-buildx unattended-upgrades
systemctl enable --now docker

step "adding swap (1 GB RAM needs it for the build)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "writing settings"
if [ ! -f .env ]; then
  IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
  SITE="${IP//./-}.sslip.io"
  rand() { openssl rand -hex 24; }
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')Aa1"
  umask 077
  cat > .env <<ENV
# Corpus365 production settings. Edit, then run: /opt/corpus365/deploy/droplet/deploy.sh --force
SITE_ADDRESS=$SITE
APP_URL=https://$SITE
POSTGRES_PASSWORD=$(rand)
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
CRON_SECRET=$(rand)
# Payments: add your Razorpay keys (rzp_test_… first), then redeploy.
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=$(rand)
ENV
  printf 'Corpus365 admin\nURL: https://%s\nEmail: %s\nPassword: %s\n(Change it after signing in, then remove ADMIN_PASSWORD from /opt/corpus365/.env)\n' \
    "$SITE" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > /root/corpus365-admin.txt
  chmod 600 /root/corpus365-admin.txt
  umask 022
fi

chmod +x deploy/droplet/*.sh
step "building the app (about 5-10 minutes)"
docker compose -f deploy/droplet/docker-compose.yml --env-file .env build app

step "starting database, migrating, starting website with HTTPS"
status_server_stop # Caddy takes over port 80
deploy/droplet/deploy.sh --force

step "installing scheduled jobs"
cat > /etc/cron.d/corpus365 <<'CRON'
SHELL=/bin/bash
# Auto-deploy new commits on main
*/5 * * * * root /opt/corpus365/deploy/droplet/deploy.sh >> /var/log/corpus365-deploy.log 2>&1
# Daily billing at 03:17 IST (server clock is UTC)
47 21 * * * root source /opt/corpus365/.env && curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/billing" >> /var/log/corpus365-billing.log 2>&1
# Nightly database backup
30 21 * * * root /opt/corpus365/deploy/droplet/backup.sh >> /var/log/corpus365-backup.log 2>&1
CRON
step "DONE: site is live"
