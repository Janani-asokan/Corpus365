/**
 * Applies pending migrations. Runs as the pre-deploy job on DigitalOcean, so
 * the schema is upgraded before new code receives traffic. A Postgres advisory
 * lock makes concurrent runs (e.g. two instances starting) safe.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPool } from "../src/server/db/connection";

const MIGRATION_LOCK = 3650001;

async function main() {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Database is up to date.");
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
