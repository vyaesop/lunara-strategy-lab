import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load apps/api/.env into process.env (Node's built-in parser). Variables
 * already set in the environment win. Skipped under NODE_ENV=test so tests
 * and E2E always use the in-memory database, never a real one.
 */
const file = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (process.env.NODE_ENV !== "test" && existsSync(file)) process.loadEnvFile(file);
