/**
 * Drops and recreates the database schema (development and CI only).
 * Refuses to run in production or against a non-local host unless
 * ALLOW_DB_RESET=true is set explicitly.
 */
import { createPool } from "../src/server/db/connection";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://localhost").hostname;
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if ((process.env.NODE_ENV === "production" || !local) && process.env.ALLOW_DB_RESET !== "true") {
    throw new Error(`Refusing to wipe the database on "${host}". Set ALLOW_DB_RESET=true if you really mean it.`);
  }
  const pool = createPool();
  try {
    await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    console.log(`Reset database on ${host}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
