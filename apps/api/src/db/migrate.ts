import { loadEnv } from "../env";
import { openDb } from "./client";

/** Apply pending migrations to the configured database (Neon/Postgres or local PGlite). */
const env = loadEnv();
const handle = await openDb({ databaseUrl: env.DATABASE_URL, pgliteDataDir: env.PGLITE_DATA_DIR, migrate: true });
console.log(`migrations applied (${handle.kind})`);
await handle.close();
