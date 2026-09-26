import { Hono } from "hono";
import { z } from "zod";
import { CreateReviewItemRequest, GradeReviewRequest, ReviewItemResponse, ReviewListResponse, ReviewQueueResponse } from "@lunara/schemas";
import type { HonoEnv } from "../context";
import { notFound } from "../errors";
import { createReviewItem, deleteReviewItem, dueQueue, gradeReviewItem, listReviewItems, setSuspended } from "../services/review";
import { parseBody } from "../validate";

export const reviewRoutes = new Hono<HonoEnv>();

reviewRoutes.get("/queue", async (c) => {
  const { db } = c.get("services");
  return c.json(ReviewQueueResponse.parse(await dueQueue(db, c.get("user").id)));
});

reviewRoutes.get("/items", async (c) => {
  const { db } = c.get("services");
  return c.json(ReviewListResponse.parse({ items: await listReviewItems(db, c.get("user").id) }));
});

reviewRoutes.post("/items", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateReviewItemRequest);
  const item = await createReviewItem(db, c.get("user").id, body);
  return c.json(ReviewItemResponse.parse({ item }), 201);
});

/** Batch create from generated questions or concepts. */
reviewRoutes.post("/items/batch", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, z.object({ items: z.array(CreateReviewItemRequest).min(1).max(20) }));
  const items = [];
  for (const it of body.items) items.push(await createReviewItem(db, c.get("user").id, it));
  return c.json(ReviewListResponse.parse({ items }), 201);
});

reviewRoutes.post("/items/:itemId/grade", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, GradeReviewRequest);
  const r = await gradeReviewItem(db, c.get("user").id, c.req.param("itemId"), body.rating, body.explanation);
  if (!r) throw notFound("Review item");
  return c.json(ReviewItemResponse.parse(r));
});

reviewRoutes.post("/items/:itemId/suspend", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, z.object({ suspended: z.boolean() }));
  const item = await setSuspended(db, c.get("user").id, c.req.param("itemId"), body.suspended);
  if (!item) throw notFound("Review item");
  return c.json(ReviewItemResponse.parse({ item }));
});

reviewRoutes.delete("/items/:itemId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteReviewItem(db, c.get("user").id, c.req.param("itemId")))) throw notFound("Review item");
  return c.json({ ok: true });
});
