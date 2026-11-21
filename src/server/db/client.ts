import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;
/** A transaction handle; services accept either so they compose inside transactions. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

function connect(): DB {
  const path = process.env.DATABASE_PATH ?? "./data/corpus365.db";
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __corpusDb?: DB };
export const db: DB = globalForDb.__corpusDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__corpusDb = db;
