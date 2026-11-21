import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";
import { createPool } from "./connection";

export type DB = NodePgDatabase<typeof schema>;
/** A transaction handle; services accept either so they compose inside transactions. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

type Holder = { pool: Pool; db: DB };
const globalForDb = globalThis as unknown as { __corpusDb?: Holder };

/** Created on first use, so building the app never needs a database. Reused across hot reloads. */
function holder(): Holder {
  if (!globalForDb.__corpusDb) {
    const pool = createPool();
    globalForDb.__corpusDb = { pool, db: drizzle(pool, { schema }) };
  }
  return globalForDb.__corpusDb;
}

export const db: DB = new Proxy({} as DB, {
  get(_target, property) {
    const target = holder().db;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export async function closeDb(): Promise<void> {
  await globalForDb.__corpusDb?.pool.end();
  globalForDb.__corpusDb = undefined;
}
