/**
 * Production bootstrap, run after migrations on every deploy. Idempotent:
 *  - inserts the launch catalogue if a product is missing (never overwrites);
 *  - creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no such user
 *    exists. Remove ADMIN_PASSWORD from the environment after first sign-in.
 * Unlike `seed`, it never creates demo businesses or orders.
 */
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/server/db/schema";
import { createPool } from "../src/server/db/connection";
import { hashPassword } from "../src/server/auth/password";
import { CATALOGUE } from "./data/catalogue";

type Db = NodePgDatabase<typeof schema>;

export async function seedCatalogue(db: Db): Promise<number> {
  let inserted = 0;
  for (const [index, { plans, partnerTiers, ...product }] of CATALOGUE.entries()) {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.products)
        .values({ ...product, sortOrder: index })
        .onConflictDoNothing({ target: schema.products.slug })
        .returning();
      if (!created) return; // already exists: admins own it now
      inserted += 1;
      if (plans?.length) await tx.insert(schema.plans).values(plans.map((plan) => ({ ...plan, productId: created.id })));
      if (partnerTiers?.length) {
        await tx.insert(schema.partnerPriceTiers).values(partnerTiers.map(([minQuantity, unitPrice]) => ({ productId: created.id, minQuantity, unitPrice })));
      }
    });
  }
  return inserted;
}

async function ensureAdmin(db: Db): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) return "ADMIN_EMAIL not set; skipped admin creation";

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) return `admin ${email} already exists`;
  if (!password || password.length < 12) throw new Error("Set ADMIN_PASSWORD (12+ characters) to create the first admin.");

  await db.insert(schema.users).values({ email, name: "Corpus365 Admin", role: "admin", passwordHash: await hashPassword(password) });
  return `created admin ${email}`;
}

async function main() {
  const pool = createPool();
  try {
    const db = drizzle(pool, { schema });
    const products = await seedCatalogue(db);
    console.log(`Catalogue: ${products} product(s) added.`);
    console.log(`Admin: ${await ensureAdmin(db)}.`);
  } finally {
    await pool.end();
  }
}

// Run only when executed directly (seed.ts imports seedCatalogue).
if (process.argv[1]?.match(/bootstrap\.(ts|cjs|js)$/)) {
  main().catch((error) => {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  });
}
