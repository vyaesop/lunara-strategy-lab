import { Hono } from "hono";
import { RecommendationResponse } from "@lunara/schemas";
import { recommend, repeatedErrorPatterns } from "@lunara/core";
import { listPublishedExercises } from "@lunara/curriculum";
import type { HonoEnv } from "../context";
import { ensureProfile, listSkills } from "../services/profile";
import { countDue } from "../services/review";
import { listSessions } from "../services/sessions";

export const recommendationRoutes = new Hono<HonoEnv>();

/** Explained recommendations computed from persisted sessions, skills and preferences. */
recommendationRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  const user = c.get("user");
  const [profile, skills, sessions, reviewsDue] = await Promise.all([ensureProfile(db, user), listSkills(db, user.id), listSessions(db, user.id, 200), countDue(db, user.id)]);
  const results = recommend({ exercises: listPublishedExercises(), sessions, skills, preferences: profile.preferences }, 4);
  const [primary, ...alternatives] = results;
  const repeatedErrors = repeatedErrorPatterns(sessions.filter((s) => s.status === "completed")).map((p) => ({ pattern: p.pattern, count: p.count }));
  return c.json(RecommendationResponse.parse({ primary: primary ?? null, alternatives, reviewsDue, repeatedErrors }));
});
