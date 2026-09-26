import { serve } from "@hono/node-server";
import { buildApp } from "./app";
import { openDb } from "./db/client";
import { loadEnv } from "./env";

const env = loadEnv();
const handle = await openDb({ databaseUrl: env.DATABASE_URL, pgliteDataDir: env.PGLITE_DATA_DIR });
const { app, services } = buildApp({ db: handle.db, env });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `lunara api listening on http://localhost:${info.port} | db=${handle.kind} | ai=${services.aiDescription.provider}:${services.aiDescription.model}${services.aiIsMock ? " (mock)" : ""}`,
  );
  if (!env.BETTER_AUTH_SECRET) console.warn("BETTER_AUTH_SECRET not set: using the development secret. Set it before deploying.");
});

const shutdown = async () => {
  server.close();
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
