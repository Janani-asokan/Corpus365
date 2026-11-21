import { mkdirSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// One throwaway database per test worker, migrated before any service loads.
const path = `./data/test-${process.env.VITEST_POOL_ID ?? "0"}-${process.pid}.db`;
mkdirSync("./data", { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });
process.env.DATABASE_PATH = path;

const sqlite = new Database(path);
migrate(drizzle(sqlite), { migrationsFolder: "./drizzle" });
sqlite.close();

import { afterAll } from "vitest";
afterAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });
});
