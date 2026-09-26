import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  BriefingRespondRequest,
  BriefingResponse,
  CreateDecisionRequest,
  CreateProjectRequestStrategy,
  DecisionListResponse,
  DecisionResponse,
  ProjectListResponse,
  ProjectResponse,
  ProjectSection,
  ProjectSuggestResponse,
  ResolvePredictionRequest,
  ReviewDecisionRequest,
  UpdateProjectRequest,
  UpsertProjectItemRequest,
} from "@lunara/schemas";
import { utcDateKey } from "@lunara/core";
import { findExercise } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { rowToReviewItem } from "../services/review";
import { reviewItems } from "../db/schema";
import { and, eq } from "drizzle-orm";
import {
  calibrationFor,
  createDecision,
  createProject,
  deleteDecision,
  deleteProject,
  deleteProjectItem,
  getOrCreateBriefing,
  getOwnedDecision,
  getOwnedProject,
  listDecisions,
  listProjects,
  respondToBriefing,
  resolvePrediction,
  reviewDecision,
  suggestProjectStructure,
  updateProject,
  upsertProjectItem,
} from "../services/strategy";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const projectRoutes = new Hono<HonoEnv>();
export const journalRoutes = new Hono<HonoEnv>();
export const briefingRoutes = new Hono<HonoEnv>();

async function loadProject(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const project = await getOwnedProject(db, c.get("user").id, c.req.param("projectId") ?? "");
  if (!project) throw notFound("Project");
  return { db, project };
}

projectRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(ProjectListResponse.parse({ projects: await listProjects(db, c.get("user").id) }));
});
projectRoutes.post("/", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateProjectRequestStrategy);
  return c.json(ProjectResponse.parse({ project: await createProject(db, c.get("user").id, body) }), 201);
});
projectRoutes.get("/:projectId", async (c) => {
  const { project } = await loadProject(c);
  return c.json(ProjectResponse.parse({ project }));
});
projectRoutes.patch("/:projectId", async (c) => {
  const { db, project } = await loadProject(c);
  const body = await parseBody(c, UpdateProjectRequest);
  return c.json(ProjectResponse.parse({ project: await updateProject(db, project, body) }));
});
projectRoutes.delete("/:projectId", async (c) => {
  const { db, project } = await loadProject(c);
  await deleteProject(db, project);
  return c.json({ ok: true });
});
projectRoutes.put("/:projectId/items", async (c) => {
  const { db, project } = await loadProject(c);
  const body = await parseBody(c, UpsertProjectItemRequest);
  return c.json(ProjectResponse.parse({ project: await upsertProjectItem(db, project, body) }));
});
projectRoutes.delete("/:projectId/items/:section/:itemId", async (c) => {
  const { db, project } = await loadProject(c);
  const section = ProjectSection.safeParse(c.req.param("section"));
  if (!section.success) throw notFound("Section");
  return c.json(ProjectResponse.parse({ project: await deleteProjectItem(db, project, section.data, c.req.param("itemId") ?? "") }));
});
projectRoutes.post("/:projectId/suggest", async (c) => {
  const { db, project } = await loadProject(c);
  const { ai, env } = c.get("services");
  await assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    return c.json(ProjectSuggestResponse.parse({ suggestions: await suggestProjectStructure(ai, project) }));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "Suggestions are unavailable right now.", { code: err.code });
    throw err;
  }
});

// ── Journal ─────────────────────────────────────────────────────────────────

async function loadDecision(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const decision = await getOwnedDecision(db, c.get("user").id, c.req.param("decisionId") ?? "");
  if (!decision) throw notFound("Decision");
  return { db, decision };
}

journalRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  const decisions = await listDecisions(db, c.get("user").id);
  return c.json(DecisionListResponse.parse({ decisions, calibration: calibrationFor(decisions) }));
});
journalRoutes.post("/", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateDecisionRequest);
  return c.json(DecisionResponse.parse({ decision: await createDecision(db, c.get("user").id, body) }), 201);
});
journalRoutes.get("/:decisionId", async (c) => {
  const { decision } = await loadDecision(c);
  return c.json(DecisionResponse.parse({ decision }));
});
journalRoutes.post("/:decisionId/review", async (c) => {
  const { db, decision } = await loadDecision(c);
  const body = await parseBody(c, ReviewDecisionRequest);
  return c.json(DecisionResponse.parse({ decision: await reviewDecision(db, decision, body) }));
});
journalRoutes.post("/:decisionId/predictions/:predictionId/resolve", async (c) => {
  const { db, decision } = await loadDecision(c);
  const body = await parseBody(c, ResolvePredictionRequest);
  return c.json(DecisionResponse.parse({ decision: await resolvePrediction(db, decision, c.req.param("predictionId") ?? "", body) }));
});
journalRoutes.delete("/:decisionId", async (c) => {
  const { db, decision } = await loadDecision(c);
  await deleteDecision(db, decision);
  return c.json({ ok: true });
});

// ── Briefing ────────────────────────────────────────────────────────────────

briefingRoutes.get("/today", async (c) => {
  const { db } = c.get("services");
  const user = c.get("user");
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(utcDateKey(new Date().toISOString())).parse(c.req.query("date"));
  const briefing = await getOrCreateBriefing(db, user, date);
  const reviewItem = briefing.reviewItemId ? await db.query.reviewItems.findFirst({ where: and(eq(reviewItems.id, briefing.reviewItemId), eq(reviewItems.userId, user.id)) }) : null;
  const exercise = briefing.exerciseId ? findExercise(briefing.exerciseId)?.public ?? null : null;
  return c.json(BriefingResponse.parse({ briefing, reviewItem: reviewItem ? rowToReviewItem(reviewItem) : null, exercise }));
});

briefingRoutes.post("/:date/respond", async (c) => {
  const { db } = c.get("services");
  const user = c.get("user");
  const body = await parseBody(c, BriefingRespondRequest);
  const briefing = await respondToBriefing(db, user.id, c.req.param("date") ?? "", body);
  if (!briefing) throw notFound("Briefing");
  const exercise = briefing.exerciseId ? findExercise(briefing.exerciseId)?.public ?? null : null;
  const reviewItem = briefing.reviewItemId ? await db.query.reviewItems.findFirst({ where: and(eq(reviewItems.id, briefing.reviewItemId), eq(reviewItems.userId, user.id)) }) : null;
  return c.json(BriefingResponse.parse({ briefing, reviewItem: reviewItem ? rowToReviewItem(reviewItem) : null, exercise }));
});
