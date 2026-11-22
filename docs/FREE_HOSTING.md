# Free hosting: Vercel + Neon

A **free** way to put Corpus365 online for demos and the pilot. The website never goes to sleep, and the database wakes in under a second.

> **Free-plan limits.** Vercel's Hobby plan is for **non-commercial use**. Use this for demos, partner previews and testing with Razorpay *test* keys. Before taking real customer payments, upgrade to Vercel Pro or deploy to DigitalOcean (see `DEPLOYMENT.md`); the code needs no changes for either. Neon's free plan has limited storage and compute hours, which is ample for a pilot.

## Steps (about 10 minutes, all in the browser)

1. **Vercel:** sign in at https://vercel.com with GitHub. Click **Add New → Project** and import **Janani-asokan/Corpus365**. Keep the defaults; `vercel.json` sets the build. Don't deploy yet if it offers; just create the project.
2. **Database:** in the project, go to **Storage → Create Database → Neon (Serverless Postgres)**. Choose the **Free** plan and the region closest to India (**Singapore**). Connect it to the project. This sets `DATABASE_URL` for you.
3. **Settings → Environment Variables** (Production). Add:

   | Name | Value |
   | --- | --- |
   | `APP_URL` | your site address, e.g. `https://corpus365.vercel.app` |
   | `ADMIN_EMAIL` | your admin sign-in email |
   | `ADMIN_PASSWORD` | 12+ characters (delete after first sign-in) |
   | `PAYMENT_PROVIDER` | `razorpay` |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay **test** keys (`rzp_test_…`) |
   | `RAZORPAY_WEBHOOK_SECRET` | any long random text |
   | `CRON_SECRET` | any long random text |

   No Razorpay account yet? Use `PAYMENT_PROVIDER=test` and `ALLOW_TEST_PAYMENTS=true` instead. Checkout then succeeds without real payment, which is for demos only.
4. **Deploy:** go to **Deployments → Redeploy** (or push to `main`). The build upgrades the database, adds the product catalogue and creates your admin, then publishes the site.
5. **After the first sign-in:** delete `ADMIN_PASSWORD` in Vercel and change your password in the app's Settings.
6. **Optional:**
   - Razorpay webhook → `https://<your-site>/api/webhooks/razorpay`.
   - GitHub repository secrets `APP_URL` and `CRON_SECRET`, so the daily renewal billing runs.

Every push to `main` then redeploys automatically. Pull requests get their own preview links, and those don't touch the database schema.

## Moving to paid hosting later

Export with `pg_dump` from Neon, restore into DigitalOcean Managed PostgreSQL, and follow `DEPLOYMENT.md`. The app is the same.
