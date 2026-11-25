# Hosting on one $6 DigitalOcean Droplet

The budget setup: one Droplet (1 vCPU, 1 GB RAM, 25 GB disk, $6/month) in Bengaluru runs everything in Docker.

```
Internet ──443──▶ Caddy (automatic HTTPS) ──▶ app (Next.js) ──▶ PostgreSQL 16 (private, not exposed)
cron: auto-deploy from GitHub main every 5 min · daily billing · nightly DB backup (7 days)
```

Files: `deploy/droplet/` holds `cloud-init.sh` (user data that hands over to `setup.sh`), `setup.sh` (first boot, with a progress page at `http://<server>/status.txt` while it runs), `docker-compose.yml`, `Caddyfile`, `deploy.sh` and `backup.sh`.

## What first boot does

1. Installs Docker, enables the firewall (SSH, HTTP and HTTPS only) and adds 2 GB swap.
2. Clones this repository to `/opt/corpus365`.
3. Writes `/opt/corpus365/.env` with freshly generated secrets: database password, `CRON_SECRET` and webhook secret. The secrets never leave the server.
4. Builds the app, migrates the database, loads the catalogue and creates the admin.
5. Serves the site at `https://<ip-with-dashes>.sslip.io`, with a free Let's Encrypt certificate. Use your own domain later by changing `SITE_ADDRESS` and `APP_URL`.

The admin's sign-in details are in `/root/corpus365-admin.txt`. Read them via DigitalOcean → Droplet → **Console**:
```bash
cat /root/corpus365-admin.txt
```
Change the password after signing in, then remove `ADMIN_PASSWORD` from `.env`.

## Day-to-day

| Task | How |
| --- | --- |
| Deploy a change | Push to `main`; the server picks it up within 5 minutes |
| Change settings (Razorpay keys, domain) | `nano /opt/corpus365/.env`, then `/opt/corpus365/deploy/droplet/deploy.sh --force` |
| Logs | `cd /opt/corpus365 && docker compose -f deploy/droplet/docker-compose.yml logs -f app` |
| Deploy log | `tail -f /var/log/corpus365-deploy.log` |
| Backups | `/var/backups/corpus365/*.dump` (nightly, 7 days) |
| Restore a backup | `docker compose -f deploy/droplet/docker-compose.yml exec -T db pg_restore -U corpus -d corpus365 --clean < FILE.dump` |

## Trade-offs to know

- **You own the server.** Ubuntu security updates install automatically (unattended-upgrades), but if the Droplet itself fails, recovery is manual.
- **Backups live on the same server.** For copies that survive losing the Droplet, turn on DigitalOcean Droplet backups (+20%, about $1.20/month), or download the dump files regularly.
- **1 GB of RAM is fine for a pilot.** When traffic grows, resize the Droplet in the control panel (data is kept), or move to App Platform plus Managed PostgreSQL (see `DEPLOYMENT.md`).
