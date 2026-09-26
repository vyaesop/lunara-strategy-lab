import { Hono, type Context } from "hono";
import { CouncilAskRequest, CouncilDecideRequest, CouncilListResponse, CouncilResponse, CreateCouncilRequest } from "@lunara/schemas";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { abandonCouncil, askRole, createCouncil, getOwnedCouncil, listCouncils, recordDecision, runCouncil } from "../services/council";
import { getOwnedTree } from "../services/trees";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const councilRoutes = new Hono<HonoEnv>();

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const council = await getOwnedCouncil(db, c.get("user").id, c.req.param("councilId") ?? "");
  if (!council) throw notFound("Council session");
  const tree = council.treeId ? await getOwnedTree(db, c.get("user").id, council.treeId) : null;
  return { db, council, tree };
}

councilRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(CouncilListResponse.parse({ councils: await listCouncils(db, c.get("user").id) }));
});

/** Create and run the council in one request: each role analyses independently, then cross-critiques. */
councilRoutes.post("/", async (c) => {
  const { db, ai, env } = c.get("services");
  const user = c.get("user");
  const body = await parseBody(c, CreateCouncilRequest);
  if (!ai.allowsUserContent("council.role")) {
    throw new ApiHttpError("forbidden", "The configured AI provider is not approved for private user content; set AI_ALLOW_USER_CONTENT or route council.role to an approved provider.");
  }
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  const tree = body.treeId ? await getOwnedTree(db, user.id, body.treeId) : null;
  if (body.treeId && !tree) throw notFound("Tree");
  const created = await createCouncil(db, user.id, body);
  try {
    const council = await runCouncil(db, ai, created, tree);
    return c.json(CouncilResponse.parse({ council }), 201);
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The council could not convene right now; your brief is saved.", { code: err.code, councilId: created.id });
    throw err;
  }
});

councilRoutes.get("/:councilId", async (c) => {
  const { council } = await loadOwned(c);
  return c.json(CouncilResponse.parse({ council }));
});

/** Re-run analyses for a council that failed to convene. */
councilRoutes.post("/:councilId/run", async (c) => {
  const { db, council, tree } = await loadOwned(c);
  const { ai, env } = c.get("services");
  if (council.status !== "analysing") throw new ApiHttpError("conflict", "Council has already convened");
  await assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    return c.json(CouncilResponse.parse({ council: await runCouncil(db, ai, council, tree) }));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The council could not convene right now.", { code: err.code });
    throw err;
  }
});

councilRoutes.post("/:councilId/ask", async (c) => {
  const { db, council, tree } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const body = await parseBody(c, CouncilAskRequest);
  if (council.status !== "open") throw new ApiHttpError("conflict", "Council is not open for questions");
  if (!council.roles.includes(body.role)) throw new ApiHttpError("invalid_request", "That role is not part of this council");
  await assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    return c.json(CouncilResponse.parse({ council: await askRole(db, ai, council, body.role, body.question, tree) }));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "That role is unavailable right now.", { code: err.code });
    throw err;
  }
});

/** The user's decision and rationale: what they accepted, rejected, and will investigate. */
councilRoutes.post("/:councilId/decision", async (c) => {
  const { db, council } = await loadOwned(c);
  const body = await parseBody(c, CouncilDecideRequest);
  if (council.status !== "open") throw new ApiHttpError("conflict", "Council is not open");
  return c.json(CouncilResponse.parse({ council: await recordDecision(db, council, body) }));
});

councilRoutes.post("/:councilId/abandon", async (c) => {
  const { db, council } = await loadOwned(c);
  return c.json(CouncilResponse.parse({ council: await abandonCouncil(db, council) }));
});
