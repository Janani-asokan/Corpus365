# Deploying to DigitalOcean (App Platform + Managed PostgreSQL)

> On a tight budget? See **[DROPLET.md](DROPLET.md)** for a single $6/month Droplet running everything.

Production runs on **DigitalOcean App Platform** (the app, always on) with **DigitalOcean Managed PostgreSQL 16** (the database), both in Bengaluru (`blr1`). The whole setup is described in `.do/app.yaml`.

```
GitHub (main) ──push──▶ App Platform ──build──▶ Docker image
                              │
                              ├─ pre-deploy job: migrate → bootstrap   (aborts the deploy on failure)
                              └─ web service (Next.js, /api/health)
                                        │ TLS, verified with the cluster CA
                                        ▼
                              Managed PostgreSQL 16 (daily backups, point-in-time recovery)
GitHub Actions ── daily ──▶ POST /api/cron/billing        Razorpay ── webhooks ──▶ /api/webhooks/razorpay
```

## One-time setup

1. **Database.** In the control panel, go to Databases → Create → PostgreSQL 16, region **Bangalore (BLR1)**, and name it **`corpus365-db`**. Basic, 1 GB RAM, is enough to launch.
   With the CLI:
   ```bash
   doctl databases create corpus365-db --engine pg --version 16 --region blr1 --size db-s-1vcpu-1gb --num-nodes 1
   ```
2. **GitHub access.** In App Platform, connect GitHub and allow DigitalOcean on `Janani-asokan/Corpus365`.
3. **Create the app** from the spec:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
   Or use Apps → Create → "Import from app spec", then upload `.do/app.yaml`.

   **Before this step**, create the database `corpus365` and the user `corpus365` inside the cluster: Databases → corpus365-db → **Users & Databases**. For a production cluster, App Platform expects both to exist already and fails the deploy with "database user was not found" if they don't. App Platform then injects `DATABASE_URL` and `DATABASE_CA_CERT`. Under the cluster's **Trusted sources**, add the app so nothing else on the internet can reach the database.
4. **Secrets.** In the app's Settings, set these values (they are encrypted at rest):

   | Variable | Where | Value |
   | --- | --- | --- |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | web | Razorpay → API keys (start with `rzp_test_…`) |
   | `RAZORPAY_WEBHOOK_SECRET` | web | a long random string; the same one goes in Razorpay |
   | `CRON_SECRET` | web | a long random string |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | migrate job | the first admin account (password 12+ characters) |

   Generate random secrets with `openssl rand -hex 32`.
5. **Deploy.** The pre-deploy job migrates the schema, loads the launch catalogue and creates the admin, then the web service starts. Open the app URL and sign in as the admin. **Then delete `ADMIN_PASSWORD`** from the job's environment and change your password in Settings.
6. **Razorpay webhook.** Go to Razorpay → Webhooks and add `https://<your-domain>/api/webhooks/razorpay` with the webhook secret. Subscribe to `order.paid`, `payment.captured` and `payment_link.paid`.
7. **Daily billing.** In GitHub → Settings → Secrets → Actions, add `APP_URL` (`https://<your-domain>`) and `CRON_SECRET`. The workflow `.github/workflows/billing.yml` then runs every day at 03:17 IST. You can also run it on demand from the Actions tab.
8. **Custom domain** (optional): Settings → Domains → add `corpus365.in` (or similar). Then update `APP_URL` in GitHub and the Razorpay webhook URL to match.

## Every deploy after that

Merge to `main`. CI type-checks, lints, tests against PostgreSQL, builds and builds the Docker image. App Platform then builds and runs the pre-deploy migration. If the migration fails, the previous version keeps serving.

## Database operations

- **Schema changes:** edit `src/server/db/schema.ts`, run `npm run db:generate`, review the SQL in `drizzle/`, and commit it. Migrations must be backwards-compatible with the version still running: add columns as nullable or with a default, and drop columns in a later release.
- **Backups:** Managed PostgreSQL keeps daily backups for 7 days with point-in-time recovery. Restore from Databases → corpus365-db → Backups (this restores into a new cluster).
- **Connections:** each app instance holds up to `DATABASE_POOL_MAX` (8) connections. Before scaling instances, check that instances × 8 stays below the plan's limit, or add a DigitalOcean connection pool (PgBouncer, transaction mode) and point `DATABASE_URL` at it.
- **Access for maintenance:** add your IP as a trusted source temporarily, then connect with `doctl databases connection corpus365-db` and `psql`.
- **Never** run `npm run db:seed` or `db:reset` in production. Seed creates fake businesses, and reset refuses non-local databases unless forced.

## Rough monthly cost

App Platform 1 GB instance, plus Managed PostgreSQL Basic 1 GB, comes to roughly **$25–30/month**. Check DigitalOcean's pricing pages for current figures. The app stays always on, so there are no cold starts.
