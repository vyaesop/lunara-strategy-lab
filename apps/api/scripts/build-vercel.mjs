/* global process, console */
// Build the API for Vercel using the Build Output API (v3).
//
// 1. On production deployments with DATABASE_URL set, apply migrations.
// 2. Bundle src/vercel.ts (and the workspace packages it imports) into one
//    ESM file inside .vercel/output/functions/index.func.
// 3. Route every request to that function.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, ".vercel/output");
const func = resolve(out, "functions/index.func");

if (process.env.VERCEL_ENV === "production" && process.env.DATABASE_URL) {
  console.log("applying migrations");
  execFileSync(process.execPath, ["--import", "tsx", "src/db/migrate.ts"], { cwd: root, stdio: "inherit" });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(func, { recursive: true });

await build({
  entryPoints: [resolve(root, "src/vercel.ts")],
  outfile: resolve(func, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: "linked",
  logLevel: "info",
  // Never used on Vercel (Postgres only) or optional native bindings.
  external: ["@electric-sql/pglite", "drizzle-orm/pglite", "drizzle-orm/pglite/migrator", "pg-native", "pg-cloudflare"],
  // CommonJS dependencies (pg) call require(); give the ESM bundle one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

writeFileSync(
  resolve(func, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 60,
    },
    null,
    2,
  ),
);

writeFileSync(
  resolve(out, "config.json"),
  JSON.stringify({ version: 3, routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index" }] }, null, 2),
);

console.log("vercel output written to", out);
