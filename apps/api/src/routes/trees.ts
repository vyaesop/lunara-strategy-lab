import { Hono, type Context } from "hono";
import { z } from "zod";
import { CreateTreeRequest, CritiqueTreeRequest, CritiqueTreeResponse, SaveTreeRequest, TreeListResponse, TreeResponse } from "@lunara/schemas";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { createTree, critiqueTree, deleteTree, getOwnedTree, listTrees, revealMoreCritique, saveTree } from "../services/trees";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const treeRoutes = new Hono<HonoEnv>();

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const tree = await getOwnedTree(db, c.get("user").id, c.req.param("treeId") ?? "");
  if (!tree) throw notFound("Tree");
  return { db, tree };
}

treeRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(TreeListResponse.parse({ trees: await listTrees(db, c.get("user").id) }));
});

treeRoutes.post("/", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateTreeRequest);
  const tree = await createTree(db, c.get("user").id, body);
  return c.json(TreeResponse.parse({ tree }), 201);
});

treeRoutes.get("/:treeId", async (c) => {
  const { tree } = await loadOwned(c);
  return c.json(TreeResponse.parse({ tree }));
});

treeRoutes.put("/:treeId", async (c) => {
  const { db, tree } = await loadOwned(c);
  const body = await parseBody(c, SaveTreeRequest);
  const saved = await saveTree(db, tree, body);
  return c.json(TreeResponse.parse({ tree: saved }));
});

treeRoutes.delete("/:treeId", async (c) => {
  const { db, tree } = await loadOwned(c);
  await deleteTree(db, tree);
  return c.json({ ok: true });
});

treeRoutes.post("/:treeId/critique", async (c) => {
  const { db, tree } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const body = await parseBody(c, CritiqueTreeRequest);
  if (body.mode !== "independent") {
    await assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  }
  try {
    const result = await critiqueTree(db, ai, tree, body.mode);
    return c.json(CritiqueTreeResponse.parse(result));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The auditor is unavailable right now; structural checks are still available in independent mode.", { code: err.code });
    throw err;
  }
});

treeRoutes.post("/:treeId/critiques/:critiqueId/reveal", async (c) => {
  const { db, tree } = await loadOwned(c);
  const body = await parseBody(c, z.object({ count: z.number().int().min(1).max(10).default(3) }).optional().default({ count: 3 }));
  if (!tree.critiques.some((x) => x.id === c.req.param("critiqueId"))) throw notFound("Critique");
  const saved = await revealMoreCritique(db, tree, c.req.param("critiqueId") ?? "", body.count);
  return c.json(TreeResponse.parse({ tree: saved }));
});
