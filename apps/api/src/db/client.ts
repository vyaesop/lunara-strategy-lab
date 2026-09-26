import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

export interface DbOptions {
  /** Postgres connection string (Neon or any Postgres). */
  databaseUrl?: string | undefined;
  /** PGlite data directory; "memory://" for tests. Used when databaseUrl is absent. */
  pgliteDataDir?: string | undefined;
  /** Run pending migrations on open (default true). */
  migrate?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = resolve(here, "../../drizzle");

/**
 * Open a database. With DATABASE_URL set this is node-postgres (works for
 * Neon and any Postgres). Without it, an embedded PGlite database is used so
 * local development and tests need no credentials.
 */
export async function openDb(options: DbOptions = {}): Promise<DbHandle> {
  const shouldMigrate = options.migrate ?? true;
  if (options.databaseUrl) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: options.databaseUrl, max: 5 });
    const db = drizzle(pool, { schema });
    if (shouldMigrate) await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return { db: db as unknown as Db, kind: "postgres", close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = options.pgliteDataDir ?? resolve(here, "../../.data/pglite");
  // PGlite creates only the leaf directory; make sure the parent exists.
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  if (shouldMigrate) await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: db as unknown as Db, kind: "pglite", close: () => client.close() };
}

export { schema };
