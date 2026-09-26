import { Hono } from "hono";
import { CompleteOnboardingRequest, MeResponse, ProfileResponse, UpdatePreferencesRequest, UpsertGoalRequest } from "@lunara/schemas";
import type { HonoEnv } from "../context";
import { newId } from "../ids";
import { parseBody } from "../validate";
import {
  completeOnboarding,
  deleteAccount,
  deleteGoal,
  ensureProfile,
  listSkills,
  updatePreferences,
  upsertGoal,
} from "../services/profile";
import { summarizeUsage } from "../services/usage";
import { exportUserData } from "../services/export";

export const meRoutes = new Hono<HonoEnv>();

meRoutes.get("/", async (c) => {
  const { db, env } = c.get("services");
  const user = c.get("user");
  const profile = await ensureProfile(db, user, env.ADMIN_EMAILS);
  const skills = await listSkills(db, user.id);
  return c.json(MeResponse.parse({ profile, skills }));
});

meRoutes.patch("/preferences", async (c) => {
  const { db } = c.get("services");
  const patch = await parseBody(c, UpdatePreferencesRequest);
  const profile = await updatePreferences(db, c.get("user"), patch);
  return c.json(ProfileResponse.parse({ profile }));
});

meRoutes.post("/onboarding", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CompleteOnboardingRequest);
  const profile = await completeOnboarding(db, c.get("user"), body.answers, body.preferences);
  return c.json(ProfileResponse.parse({ profile }));
});

meRoutes.put("/goals", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, UpsertGoalRequest);
  const profile = await upsertGoal(db, c.get("user"), body, () => newId("goal"));
  return c.json(ProfileResponse.parse({ profile }));
});

meRoutes.delete("/goals/:goalId", async (c) => {
  const { db } = c.get("services");
  const profile = await deleteGoal(db, c.get("user"), c.req.param("goalId"));
  return c.json(ProfileResponse.parse({ profile }));
});

meRoutes.get("/usage", async (c) => {
  const { db, env } = c.get("services");
  const summary = await summarizeUsage(db, c.get("user").id, {
    dailyLimit: env.AI_DAILY_REQUEST_LIMIT,
    monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD,
  });
  return c.json(summary);
});

/** Everything the user owns, as a downloadable JSON document. */
meRoutes.get("/export", async (c) => {
  const { db, env } = c.get("services");
  await ensureProfile(db, c.get("user"), env.ADMIN_EMAILS);
  const data = await exportUserData(db, c.get("user").id);
  c.header("content-disposition", `attachment; filename="lunara-export-${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(data);
});

/** Delete the account and all owned data. The client must sign out afterwards. */
meRoutes.delete("/", async (c) => {
  const { db } = c.get("services");
  await deleteAccount(db, c.get("user").id);
  return c.json({ ok: true });
});
