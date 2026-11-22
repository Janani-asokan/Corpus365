#!/usr/bin/env bash
# First-boot setup for an Ubuntu 24.04 Droplet (passed as user data).
# ADMIN_EMAIL is filled in when the Droplet is created.
set -euxo pipefail
ADMIN_EMAIL="__ADMIN_EMAIL__"
REPO="https://github.com/Janani-asokan/Corpus365.git"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 docker-buildx git ufw unattended-upgrades
systemctl enable --now docker

# 1 GB RAM: add swap so the Next.js build has room.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable

git clone "$REPO" /opt/corpus365
cd /opt/corpus365

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

chmod +x deploy/droplet/*.sh
deploy/droplet/deploy.sh --force

cat > /etc/cron.d/corpus365 <<'CRON'
SHELL=/bin/bash
# Auto-deploy new commits on main
*/5 * * * * root /opt/corpus365/deploy/droplet/deploy.sh >> /var/log/corpus365-deploy.log 2>&1
# Daily billing at 03:17 IST (server clock is UTC)
47 21 * * * root source /opt/corpus365/.env && curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/billing" >> /var/log/corpus365-billing.log 2>&1
# Nightly database backup
30 21 * * * root /opt/corpus365/deploy/droplet/backup.sh >> /var/log/corpus365-backup.log 2>&1
CRON
echo "Corpus365 is up at https://$SITE"
