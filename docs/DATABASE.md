# Database design

PostgreSQL 16, managed with Drizzle ORM. The schema lives in `src/server/db/schema.ts`; migrations are SQL files in `drizzle/`.

## Conventions

| Concern | Choice | Why |
| --- | --- | --- |
| Keys | `uuid` primary keys, `gen_random_uuid()` | Not guessable from URLs; safe to generate anywhere |
| Money | `bigint` paise, with a `currency char(3)` | Exact arithmetic; ready for GCC currencies (wave 3) |
| Rates | `integer` basis points, `CHECK 0–10000` | 30% = 3000; no floating-point drift |
| Time | `timestamptz` | Stored in UTC; correct across time zones |
| Enumerations | Postgres `ENUM` types | Invalid states can't be stored; self-documenting |
| Audit columns | `created_at` everywhere; `updated_at` maintained by trigger | Correct even for writes outside the app |
| Deletes | Explicit `ON DELETE` on every FK. Financial rows `RESTRICT`; sessions and tokens `CASCADE` | Financial history can never vanish by accident |
| Snapshots | `order_items.description` and prices; `commissions.rate` and `tier` | Later catalogue or tier changes never rewrite history |

## Invariants enforced by the database

These hold even if application code has a bug or two requests race:

- **One subscription per business per app:** `UNIQUE (user_id, product_id)`. Billing history lives in `orders`.
- **At most one unpaid renewal bill per subscription:** a partial unique index on `orders(subscription_id)` where the order is a pending renewal.
- **Commission paid once per order line:** `UNIQUE (order_item_id, kind)`. Webhook retries are harmless.
- **Order arithmetic:** `total = subtotal + tax` and `line_total = unit_price × quantity`.
- **State consistency:**
  - an order is `paid` if and only if it has `paid_at`;
  - a renewal order always has its subscription;
  - an `in_payout`/`paid` commission always has a payout;
  - an `approved` partner always has `approved_at`.
- **Formats:** lowercase unique emails, GSTIN pattern, partner-code pattern, payout period `YYYY-MM`.
- **No self-referral:** a user can't be their own referring partner.
- **Append-only audit log:** `UPDATE` and `DELETE` on `audit_events` raise an error.
- **Race-free order numbers:** a database sequence (`C365-001001…`).

These are verified by `tests/schema-invariants.test.ts`.

## Concurrency

- Paying an order locks its row (`SELECT … FOR UPDATE`), so the browser confirmation and a Razorpay webhook arriving together cannot both fulfil it.
- Redeeming a licence key locks the key row; payout runs and migrations take Postgres advisory locks.

## Indexes

Every foreign key is indexed (Postgres doesn't do this automatically), plus the hot paths:
- a customer's orders by date;
- due subscriptions `(status, current_period_end)`;
- a partner's commissions `(partner_id, status, created_at)`;
- leads by recency;
- the audit log by time.

## Tables

| Area | Tables |
| --- | --- |
| Identity | `users`, `sessions`, `password_reset_tokens`, `partner_profiles` |
| Catalogue | `products`, `plans`, `partner_price_tiers` |
| Sales | `orders`, `order_items`, `subscriptions`, `licence_keys` |
| Partner earnings | `commissions`, `payouts` |
| Pipeline | `leads`, `quote_requests` |
| Accountability | `audit_events` |
