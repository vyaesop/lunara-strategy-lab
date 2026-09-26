import { Hono } from "hono";
import { ExerciseListResponse, ExerciseResponse } from "@lunara/schemas";
import { findExercise, listPublishedExercises } from "@lunara/curriculum";
import type { HonoEnv } from "../context";
import { notFound } from "../errors";

export const exerciseRoutes = new Hono<HonoEnv>();

exerciseRoutes.get("/", (c) => {
  return c.json(ExerciseListResponse.parse({ exercises: listPublishedExercises() }));
});

exerciseRoutes.get("/:exerciseId", (c) => {
  const ex = findExercise(c.req.param("exerciseId"));
  if (!ex || ex.public.status !== "published") throw notFound("Exercise");
  // Only the public part ever leaves the server here.
  return c.json(ExerciseResponse.parse({ exercise: ex.public }));
});
