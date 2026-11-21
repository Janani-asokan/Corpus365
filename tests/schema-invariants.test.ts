import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/server/db/client";

/**
 * The database enforces the business rules on its own, so a bug or race in
 * application code cannot corrupt data. Each case must be rejected by Postgres.
 */
afterAll(() => closeDb());

async function rejects(statement: ReturnType<typeof sql>, constraint: string) {
  const error = await db.execute(statement).then(() => null, (e: { cause?: { constraint?: string; message?: string } }) => e.cause);
  expect(error?.constraint ?? error?.message).toContain(constraint);
}

const user = (email: string) => sql`insert into users (email, name, password_hash, role) values (${email}, 'n', 'h', 'client') returning id`;

describe("database invariants", () => {
  it("normalises emails and keeps them unique", async () => {
    await rejects(user("Mixed@Case.com"), "users_email_lowercase");
    await db.execute(user("dup@x.com"));
    await rejects(user("dup@x.com"), "users_email_key");
  });

  it("keeps order totals consistent and numbers unique", async () => {
    const [u] = (await db.execute<{ id: string }>(user("buyer@x.com"))).rows;
    await rejects(
      sql`insert into orders (user_id, kind, subtotal, tax, total, billing_name) values (${u!.id}, 'retail', 100, 18, 200, 'b')`,
      "orders_amounts_valid",
    );
    await rejects(
      sql`insert into orders (user_id, kind, subtotal, tax, total, billing_name, status) values (${u!.id}, 'retail', 100, 18, 118, 'b', 'paid')`,
      "orders_paid_consistency",
    );
    const numbers = (
      await db.execute<{ number: string }>(
        sql`insert into orders (user_id, kind, subtotal, tax, total, billing_name) values (${u!.id}, 'retail', 1, 0, 1, 'b'), (${u!.id}, 'retail', 1, 0, 1, 'b') returning number`,
      )
    ).rows.map((r) => r.number);
    expect(new Set(numbers).size).toBe(2);
    expect(numbers[0]).toMatch(/^C365-\d{6}$/);
  });

  it("rejects negative or inconsistent money and rates", async () => {
    await rejects(
      sql`insert into products (slug, name, type, category, tagline, description, status, icon, unit_price) values ('bad', 'n', 'hardware', 'c', 't', 'd', 'live', 'i', -5)`,
      "products_unit_price_positive",
    );
    await rejects(
      sql`insert into products (slug, name, type, category, tagline, description, status, icon, hardware_margin) values ('bad2', 'n', 'hardware', 'c', 't', 'd', 'live', 'i', 20000)`,
      "products_margin_range",
    );
  });

  it("keeps the audit log append-only", async () => {
    await db.execute(sql`insert into audit_events (action) values ('test')`);
    const error = await db.execute(sql`delete from audit_events`).then(() => null, (e: { cause?: { message?: string } }) => e.cause?.message);
    expect(error).toContain("append-only");
  });

  it("maintains updated_at automatically", async () => {
    const [row] = (await db.execute<{ id: string; updated_at: Date }>(sql`insert into users (email, name, password_hash, role) values ('touch@x.com', 'n', 'h', 'client') returning id, updated_at`)).rows;
    await new Promise((r) => setTimeout(r, 20));
    const [after] = (await db.execute<{ updated_at: Date }>(sql`update users set name = 'changed' where id = ${row!.id} returning updated_at`)).rows;
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(row!.updated_at).getTime());
  });
});
