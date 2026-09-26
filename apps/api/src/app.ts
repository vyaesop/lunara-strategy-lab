import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { buildAIFromEnv } from "@lunara/ai";
import { validateCurriculum } from "@lunara/curriculum";
import { createAuth } from "./auth";
import { requestContext, type HonoEnv, type Services } from "./context";
import type { Db } from "./db/client";
import type { AppEnv } from "./env";
import { ApiHttpError } from "./errors";
import { newId } from "./ids";
import { rateLimit, requireUser } from "./middleware";
import { aiRoutes } from "./routes/ai";
import { exerciseRoutes } from "./routes/exercises";
import { investigationRoutes, investigationSessionRoutes } from "./routes/investigations";
import { treeRoutes } from "./routes/trees";
import { simulationRoutes, simulationSessionRoutes } from "./routes/simulations";
import { councilRoutes } from "./routes/council";
import { readingRoutes } from "./routes/reading";
import { knowledgeRoutes } from "./routes/knowledge";
import { reviewRoutes } from "./routes/review";
import { briefingRoutes, journalRoutes, projectRoutes } from "./routes/strategy";
import { negotiationRoutes, negotiationSessionRoutes } from "./routes/negotiations";
import { missionRoutes, missionSessionRoutes } from "./routes/missions";
import { challengeRoutes, gameRoutes } from "./routes/game-challenge";
import { adminRoutes } from "./routes/admin";
import { meRoutes } from "./routes/me";
import { recommendationRoutes } from "./routes/recommendations";
import { sessionRoutes } from "./routes/sessions";
import { createUsageSink } from "./services/usage";

export interface BuildAppOptions {
  db: Db;
  env: AppEnv;
  /** Override for tests. */
  ai?: ReturnType<typeof buildAIFromEnv>;
  quiet?: boolean;
}

export function buildServices(options: BuildAppOptions): Services {
  const curriculum = validateCurriculum();
  if (!curriculum.ok) throw new Error(`Curriculum invalid:\n${curriculum.errors.join("\n")}`);
  const ai = options.ai ?? buildAIFromEnv(options.env.raw, { usageSink: createUsageSink(options.db) });
  const turn = ai.routes["coach.turn"];
  return {
    db: options.db,
    env: options.env,
    auth: createAuth(options.db, options.env),
    ai: ai.router,
    aiIsMock: ai.defaultProvider === "mock",
    aiDescription: { provider: turn.provider, model: turn.model },
  };
}

export function buildApp(options: BuildAppOptions) {
  const services = buildServices(options);
  const app = new Hono<HonoEnv>();

  if (!options.quiet && options.env.NODE_ENV !== "test") app.use(logger());
  app.use(secureHeaders());
  app.use("*", async (c, next) => {
    c.set("services", services);
    const requestId = newId("req", 12);
    c.header("x-request-id", requestId);
    await requestContext.run({ userId: null, requestId }, next);
  });
  // Body limits: generous only for the PDF upload route.
  app.use("/api/v1/reading/documents/upload", bodyLimit({ maxSize: 20 * 1024 * 1024 }));
  app.use("/api/*", bodyLimit({ maxSize: 3 * 1024 * 1024, onError: (c) => c.json({ error: { code: "invalid_request", message: "Request body too large" } }, 413) }));
  app.use(
    "*",
    cors({
      origin: (origin) => (services.env.CLIENT_ORIGINS.includes(origin) ? origin : null),
      credentials: true,
      allowHeaders: ["content-type", "authorization"],
      exposeHeaders: ["set-auth-token", "x-ratelimit-remaining", "x-ratelimit-limit", "retry-after"],
      maxAge: 600,
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, ai: services.aiDescription, mock: services.aiIsMock }));

  // Better Auth owns everything under /api/auth/*
  app.on(["GET", "POST"], "/api/auth/*", (c) => services.auth.handler(c.req.raw));

  const v1 = new Hono<HonoEnv>();
  v1.use("*", requireUser, rateLimit);
  v1.route("/me", meRoutes);
  v1.route("/exercises", exerciseRoutes);
  v1.route("/sessions", sessionRoutes);
  v1.route("/recommendations", recommendationRoutes);
  v1.route("/investigations", investigationRoutes);
  v1.route("/investigation-sessions", investigationSessionRoutes);
  v1.route("/trees", treeRoutes);
  v1.route("/simulations", simulationRoutes);
  v1.route("/simulation-sessions", simulationSessionRoutes);
  v1.route("/council", councilRoutes);
  v1.route("/reading", readingRoutes);
  v1.route("/knowledge", knowledgeRoutes);
  v1.route("/review", reviewRoutes);
  v1.route("/projects", projectRoutes);
  v1.route("/journal", journalRoutes);
  v1.route("/briefing", briefingRoutes);
  v1.route("/negotiations", negotiationRoutes);
  v1.route("/negotiation-sessions", negotiationSessionRoutes);
  v1.route("/missions", missionRoutes);
  v1.route("/mission-sessions", missionSessionRoutes);
  v1.route("/game", gameRoutes);
  v1.route("/challenges", challengeRoutes);
  v1.route("/admin", adminRoutes);
  v1.route("/ai", aiRoutes);
  app.route("/api/v1", v1);

  app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found" } }, 404));
  app.onError((err, c) => {
    const requestId = requestContext.getStore()?.requestId ?? "-";
    if (err instanceof ApiHttpError) return c.json(err.toBody(), err.status as 400);
    // Structured, content-free error log: request id, route, and message only.
    if (!options.quiet) console.error(JSON.stringify({ level: "error", requestId, method: c.req.method, path: c.req.path, message: err instanceof Error ? err.message : String(err) }));
    return c.json({ error: { code: "internal", message: "Internal error", details: { requestId } } }, 500);
  });

  return { app, services };
}
