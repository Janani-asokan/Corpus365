# Corpus365 Marketplace

Business software for every business, sold and supported by people near you.

A two-sided marketplace: **businesses** browse apps and hardware, start free trials, subscribe and renew; **Channel Partners** share a referral link or code, track clients and leads, and earn commission on every sale and every renewal; **admins** approve partners, run billing and pay partners monthly.

## Quick start

Requires Node.js 22+ and PostgreSQL 16.

```bash
npm install
createdb corpus365                 # and corpus365_test for the test suite
cp .env.example .env               # set DATABASE_URL
npm run setup                      # migrate + load demo data
npm run dev                        # http://localhost:3000
```

Production runs on DigitalOcean (App Platform plus Managed PostgreSQL). See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The schema and its guarantees are described in **[docs/DATABASE.md](docs/DATABASE.md)**.

Demo accounts (seed data):

| Role    | Email                    | Password        |
| ------- | ------------------------ | --------------- |
| Admin   | `admin@corpus365.test`   | `Admin@12345`   |
| Partner | `partner@corpus365.test` | `Partner@12345` |
| Client  | `client@corpus365.test`  | `Client@12345`  |

Try a partner link: `http://localhost:3000/r/ANU365?to=school-erp-management`.

Emails (welcome, password reset, receipts, payouts) are printed to the server log in development.

| Script              | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Development server                         |
| `npm run build`     | Production build (type-checks and lints)   |
| `npm test`          | Unit and integration tests (business rules, payment flows) |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | TypeScript                                 |
| `npm run db:migrate` | Apply pending migrations                  |
| `npm run db:seed`   | Load demo data (development only)          |
| `npm run db:reset`  | Wipe and recreate with demo data (local only) |
| `npm run db:bootstrap` | Production: launch catalogue + first admin (idempotent) |
| `npm run db:generate` | Generate a migration after editing the schema |

## Payments (Razorpay)

Payments run through **Razorpay**. Locally, without keys, checkout uses an instant **test** gateway.

How a payment flows:

1. The server creates a pending order and a Razorpay order for the exact amount.
2. Razorpay Checkout opens in the browser (UPI, cards, net banking, wallets).
3. The browser returns a signed proof, and the server verifies the HMAC signature before fulfilling anything.
4. The `order.paid` / `payment.captured` webhook also fulfils the order, in case the customer closes the tab after paying. Fulfilment is idempotent, so retries and overlapping events are harmless.

Payments the customer was never asked for are refused, and so is any webhook whose amount doesn't match the order.

**Renewals.** Razorpay can't silently re-charge a customer without an e-mandate. The daily billing job therefore sends a Razorpay **Payment Link** by email and SMS. The link also shows on the client's Subscriptions page. Access continues for a 7-day grace period, then lapses if unpaid. Paying renews from the old period end, so no days are lost or gained.

### Going live with Razorpay

1. In the Razorpay Dashboard, create **test** API keys first (`rzp_test_…`).
2. Set the environment variables (see `.env.example`):
   ```bash
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_test_…
   RAZORPAY_KEY_SECRET=…
   RAZORPAY_WEBHOOK_SECRET=…      # any strong secret you choose
   APP_URL=https://your-domain
   CRON_SECRET=…                  # any strong secret
   ```
3. Under **Webhooks**, add `https://your-domain/api/webhooks/razorpay` with the same secret, and subscribe to `order.paid`, `payment.captured` and `payment_link.paid`.
4. Schedule the billing job daily:
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/billing`
5. Make a test purchase using the UPI ID `success@razorpay` or a Razorpay test card. Admin → Overview shows "Razorpay connected · test mode".
6. When Razorpay activates your account, swap in the `rzp_live_…` keys.

In production, the site refuses test payments unless `ALLOW_TEST_PAYMENTS=true`, so a missing key can never give products away. Instead, admins see "Payments are switched off" and checkout shows a clear message.

## Features

**Storefront** — catalogue of apps and hardware with search and filters · plan picker (monthly / yearly with savings) · 14-day free trials · cart and checkout with 18% GST and optional GSTIN · printable tax invoices · site quotes for per-site hardware.

**Business account** — subscriptions with licence keys · renew now, auto-renew on/off, reactivate · redeem a partner's licence key · orders and invoices · contact card for their local partner.

**Partner portal** — referral link builder (any product, WhatsApp share) · tier and progress to the next tier · earnings split into pending clearance / available / in payout / paid · commission history that keeps the rate used · clients and lead pipeline · bulk ordering at partner volume prices (licence packs issue keys) · training and resources.

**Admin** — live metrics against the month-12 targets (clients, partners, channel cost under 30%) · partner application review (approve / reject / suspend) · billing cycle (end trials, honour cancellations, auto-renew) · monthly payout run and mark-paid with reference · catalogue status control · quote requests · audit log.

## Architecture

```
src/
  domain/        Pure business rules: money, tiers, commission, pricing. No I/O; unit-tested.
  server/
    db/          Drizzle schema (PostgreSQL) + connection pool
    auth/        Sessions, password hashing, rate limiting, role guards
    services/    Use cases (orders, subscriptions, commissions, payouts, partners…) in transactions
    actions/     Server Actions: validate input → authorise → call a service
    payments/    PaymentGateway port, Razorpay adapter (orders, payment links, signatures), test adapter
    mail/        Mailer port + console adapter
  components/    UI kit (ui/), layout, and feature components
  app/           Routes (Next.js App Router)
```

Dependencies point inwards: routes → actions → services → domain. The domain knows nothing about the database or the web, so the commercial rules (all marked *proposed* in the brief) live in two files, `domain/tiers.ts` and `domain/program.ts`, and can be tuned without touching anything else.

### Business rules

- **Tiers** by the partner's *own* active clients: Channel 0–9 (20% / 10%), Silver 10–24 (25% / 12%), Gold 25–49 + 80% renewing (30% / 15%), Platinum 50+ + 85% renewing (35% / 20%). Until 10 subscriptions have come up for renewal, the renewal-rate requirement counts as met, so first-year partners aren't blocked by missing history.
- **Single level**: commission only on the partner's own clients' sales and renewals; never on recruiting.
- **Hardware** earns a one-time per-product margin (8–12%).
- **Launch bonus**: a fixed amount on each of the first 3 sales within 60 days of approval.
- **Attribution** is first-touch and then locked to the client's account. Partners can never be credited for their own purchases.
- **Commissions** store the tier and rate at the time of sale, are held for a 14-day refund window, then bundled into a monthly payout. Their status moves from *pending* to *in payout* to *paid*, so nothing can be paid twice.
- **Money** is integer paise (`bigint`) and rates are basis points, so there are no floating-point errors.
- The database enforces the key rules itself (see docs/DATABASE.md).

### Security

- Opaque database sessions: the cookie is httpOnly, SameSite=Lax and Secure in production, and only a SHA-256 of the token is stored. Sessions are revoked on logout and on password reset.
- bcrypt password hashing, with timing kept the same whether or not an account exists.
- Login rate limiting.
- Password reset and the forgot-password form don't reveal whether an email is registered.
- Every protected page and action re-checks the session and role on the server. Middleware is only a fast redirect.
- All input is validated with Zod. Prices always come from the database; the cart cookie holds only ids and quantities.
- Same-site checks stop open redirects after login. Server Actions are protected against CSRF.
- Security headers are set (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). Sensitive admin actions are written to an audit log.

### Usability and compatibility

- Responsive from 320px up. Tables scroll horizontally inside their cards, never the whole page.
- Labelled fields with errors linked for screen readers, visible focus, a skip link, and reduced-motion support.
- Forms keep what you typed when validation fails (passwords excepted).
- Most pages and forms are server-rendered and work as plain HTML forms.

## Before going live

1. **Payments**: configure Razorpay (see *Going live with Razorpay* above).
2. **Email**: implement `Mailer` (e.g. SES or Postmark) and register it with `setMailer`.
3. **Scaling out**: before running more than one instance, move the login rate limiter to Redis (DigitalOcean Managed Valkey), behind the same interface.
4. **Billing job**: call `POST /api/cron/billing` daily. Admins can also run it from Admin → "Process due renewals".
5. **Content**: product prices, the launch bonus amount and support contacts are placeholders (see `scripts/seed.ts`, `domain/program.ts`, `lib/config.ts`). The partner agreement page is a plain-language summary and needs legal review.
6. Set `APP_URL` to your public URL, so referral links and emails point to the right place.
