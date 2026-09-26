import { Hono } from "hono";
import { z } from "zod";
import { ConceptResponse, CreateConceptRequest, CreateRelationRequest, KnowledgeGraphResponse, UpdateConceptRequest } from "@lunara/schemas";
import type { HonoEnv } from "../context";
import { notFound } from "../errors";
import { createRelation, deleteConcept, deleteRelation, listConcepts, listRelations, mergeConcept, updateConcept, upsertConcept } from "../services/knowledge";
import { parseBody } from "../validate";

export const knowledgeRoutes = new Hono<HonoEnv>();

knowledgeRoutes.get("/graph", async (c) => {
  const { db } = c.get("services");
  const user = c.get("user");
  const [concepts, relations] = await Promise.all([listConcepts(db, user.id), listRelations(db, user.id)]);
  return c.json(KnowledgeGraphResponse.parse({ concepts, relations }));
});

/** Idempotent on canonical name: returns the existing concept instead of creating a duplicate. */
knowledgeRoutes.post("/concepts", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateConceptRequest);
  const { concept, existing } = await upsertConcept(db, c.get("user").id, body);
  return c.json(ConceptResponse.parse({ concept, mergedInto: existing ? concept.id : null }), existing ? 200 : 201);
});

knowledgeRoutes.patch("/concepts/:conceptId", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, UpdateConceptRequest);
  const concept = await updateConcept(db, c.get("user").id, c.req.param("conceptId"), body);
  if (!concept) throw notFound("Concept");
  return c.json(ConceptResponse.parse({ concept, mergedInto: null }));
});

knowledgeRoutes.post("/concepts/:conceptId/merge", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, z.object({ intoId: z.string().min(1) }));
  const concept = await mergeConcept(db, c.get("user").id, c.req.param("conceptId"), body.intoId);
  if (!concept) throw notFound("Concept");
  return c.json(ConceptResponse.parse({ concept, mergedInto: concept.id }));
});

knowledgeRoutes.delete("/concepts/:conceptId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteConcept(db, c.get("user").id, c.req.param("conceptId")))) throw notFound("Concept");
  return c.json({ ok: true });
});

knowledgeRoutes.post("/relations", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateRelationRequest);
  const relation = await createRelation(db, c.get("user").id, body);
  return c.json({ relation }, 201);
});

knowledgeRoutes.delete("/relations/:relationId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteRelation(db, c.get("user").id, c.req.param("relationId")))) throw notFound("Relation");
  return c.json({ ok: true });
});
