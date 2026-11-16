import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./schema";
import { seedDatabase } from "./seed";

/**
 * SQLite database (Node.js built-in `node:sqlite`). Server-only.
 * DATABASE_PATH overrides the location; ":memory:" gives a private database
 * (used by tests). The database is migrated and seeded on first open.
 */
export type Database = DatabaseSync;

export function defaultDatabasePath() {
  return (
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), ".data", "industrihub.db")
  );
}

export function migrate(db: Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as {
        version: number;
      }[]
    ).map((r) => r.version),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(migration.version, new Date().toISOString());
    });
  }
}

export function openDatabase(file = defaultDatabasePath()): Database {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  seedDatabase(db);
  return db;
}

/**
 * Runs `fn` inside BEGIN/COMMIT; rolls back on any error. A call made while a
 * transaction is already open joins it instead of starting a new one.
 */
export function transaction<T>(db: Database, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Next value of a named counter, e.g. nextNumber(db, "RFQ", "RFQ-IH-", 1000). */
export function nextNumber(
  db: Database,
  name: string,
  prefix: string,
  start = 0,
  width = 5,
) {
  db.prepare(
    "INSERT INTO sequences (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = value + 1",
  ).run(name, start + 1);
  const { value } = db
    .prepare("SELECT value FROM sequences WHERE name = ?")
    .get(name) as { value: number };
  return `${prefix}${String(value).padStart(width, "0")}`;
}

export function now() {
  return new Date().toISOString();
}

const globalDb = globalThis as typeof globalThis & {
  __industrihubDb?: Database;
};

/** Process-wide database connection. */
export function getDb(): Database {
  return (globalDb.__industrihubDb ??= openDatabase());
}

/** Tests only: replace the shared connection (e.g. with a fresh in-memory db). */
export function setDbForTesting(db: Database | undefined) {
  globalDb.__industrihubDb = db;
}
