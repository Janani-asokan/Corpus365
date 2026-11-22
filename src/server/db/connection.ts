import { Pool, type PoolConfig } from "pg";

/**
 * Connection settings shared by the app and the migration/seed scripts.
 *
 * DATABASE_URL       postgres://user:pass@host:port/db
 * DATABASE_CA_CERT   PEM of the server CA. DigitalOcean Managed PostgreSQL
 *                    provides it (App Platform: ${db.CA_CERT}); when set, TLS
 *                    is verified against it.
 * DATABASE_SSL       "disable" for local development without TLS.
 * DATABASE_POOL_MAX  connections per app instance (default 10). Keep
 *                    instances × pool below the plan's connection limit,
 *                    or point DATABASE_URL at a DigitalOcean connection pool.
 */
export function poolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set. See .env.example.");

  const url = new URL(raw);
  const sslMode = env.DATABASE_SSL ?? url.searchParams.get("sslmode") ?? "require";
  // We pass TLS options explicitly; a sslmode left in the URL would override them.
  url.searchParams.delete("sslmode");

  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl = sslMode === "disable" ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };

  return {
    connectionString: url.toString(),
    ssl,
    // Serverless platforms (Vercel) run many small instances: keep each pool tiny.
    max: Number(env.DATABASE_POOL_MAX ?? (env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "corpus365",
  };
}

export function createPool(env?: NodeJS.ProcessEnv): Pool {
  const pool = new Pool(poolConfig(env));
  pool.on("error", (error) => console.error("[db] idle client error", error));
  return pool;
}
