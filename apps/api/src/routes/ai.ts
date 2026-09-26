import { Hono } from "hono";
import { AIHealthResponse } from "@lunara/schemas";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";

export const aiRoutes = new Hono<HonoEnv>();

/** Cheap liveness probe of the configured default route. Authenticated to avoid abuse. */
aiRoutes.get("/health", async (c) => {
  const { ai, aiIsMock, aiDescription } = c.get("services");
  const started = Date.now();
  let ok = true;
  try {
    await ai.generate("health", [{ role: "user", content: "Reply with the single word: ready" }], { maxOutputTokens: 5 });
  } catch (err) {
    ok = false;
    if (!isAIError(err)) throw err;
  }
  return c.json(
    AIHealthResponse.parse({
      provider: aiDescription.provider,
      model: aiDescription.model,
      ok,
      latencyMs: Date.now() - started,
      mock: aiIsMock,
    }),
  );
});
