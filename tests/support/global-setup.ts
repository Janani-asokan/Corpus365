import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPool } from "../../src/server/db/connection";

/** Gives every test run a freshly migrated, empty database. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://corpus:corpus@localhost:5432/corpus365_test";
  if (!/_test\b/.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL must point at a *_test database");
  process.env.DATABASE_URL = url;
  process.env.DATABASE_SSL ??= "disable";

  const pool = createPool();
  try {
    await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
