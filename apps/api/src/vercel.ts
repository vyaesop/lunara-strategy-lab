import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { buildApp } from "./app";
import { openDb } from "./db/client";
import { loadEnv } from "./env";

/**
 * Vercel Node function entry (bundled by scripts/build-vercel.mjs).
 * The database pool and app are created once per warm instance. Migrations
 * run at build time for production deployments, never per request.
 */
type Listener = ReturnType<typeof getRequestListener>;
let ready: Promise<Listener> | null = null;

function init(): Promise<Listener> {
  ready ??= (async () => {
    const source = { ...process.env };
    // Default the auth base URL to this project's production domain.
    if (!source.BETTER_AUTH_URL && source.VERCEL_PROJECT_PRODUCTION_URL) {
      source.BETTER_AUTH_URL = `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    const env = loadEnv(source);
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required on Vercel");
    const handle = await openDb({ databaseUrl: env.DATABASE_URL, migrate: false });
    const { app } = buildApp({ db: handle.db, env });
    return getRequestListener(app.fetch);
  })().catch((err: unknown) => {
    ready = null; // retry initialisation on the next request
    throw err;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let listener: Listener;
  try {
    listener = await init();
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "startup failed", error: err instanceof Error ? err.message : String(err) }));
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "startup_failed", message: "The API could not start" } }));
    return;
  }
  await listener(req, res);
}
