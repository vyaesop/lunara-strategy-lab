import { Hono } from "hono";
import { z } from "zod";
import {
  AskDocumentRequest,
  AskDocumentResponse,
  CreateDocumentRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  DocumentListResponse,
  DocumentResponse,
  DocumentTextResponse,
  GenerateQuestionsRequest,
  GenerateQuestionsResponse,
  NoteListResponse,
  NoteResponse,
  UpdateDocumentRequest,
} from "@lunara/schemas";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, invalid, notFound } from "../errors";
import {
  askDocument,
  createDocument,
  createNote,
  createProject,
  deleteDocument,
  deleteNote,
  deleteProject,
  extractPdf,
  generateQuestions,
  getOwnedDocument,
  listDocuments,
  listNotes,
  listProjects,
  rowToDocument,
  updateDocument,
  updateNote,
} from "../services/reading";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const readingRoutes = new Hono<HonoEnv>();

readingRoutes.get("/documents", async (c) => {
  const { db } = c.get("services");
  const user = c.get("user");
  const [documents, projects] = await Promise.all([listDocuments(db, user.id), listProjects(db, user.id)]);
  return c.json(DocumentListResponse.parse({ documents, projects }));
});

readingRoutes.post("/documents", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateDocumentRequest);
  if (body.kind !== "link" && body.content.trim().length === 0) throw invalid("Content is empty");
  const document = await createDocument(db, c.get("user").id, body);
  return c.json(DocumentResponse.parse({ document }), 201);
});

/** multipart/form-data: file=<pdf>, title?, projectId? */
readingRoutes.post("/documents/upload", async (c) => {
  const { db } = c.get("services");
  const form = await c.req.parseBody();
  const file = form["file"];
  if (!(file instanceof File)) throw invalid("Attach a PDF as the 'file' field");
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw invalid("Only PDF uploads are supported");
  const buffer = await file.arrayBuffer();
  let extracted: Awaited<ReturnType<typeof extractPdf>>;
  try {
    extracted = await extractPdf(buffer);
  } catch (err) {
    if (err instanceof ApiHttpError) throw err;
    throw invalid("Could not read that PDF; it may be scanned images without a text layer.");
  }
  if (extracted.text.trim().length === 0) throw invalid("The PDF has no extractable text (scanned pages need OCR, which is not yet supported).");
  const title = typeof form["title"] === "string" && form["title"].trim() ? form["title"].trim().slice(0, 280) : file.name.replace(/\.pdf$/i, "").slice(0, 280);
  const projectId = typeof form["projectId"] === "string" && form["projectId"] ? form["projectId"] : null;
  const document = await createDocument(db, c.get("user").id, {
    kind: "text",
    kindOverride: "pdf",
    title,
    content: extracted.text,
    author: "",
    sourceUrl: null,
    projectId,
    tags: [],
    pageStarts: extracted.pageStarts,
    pageCount: extracted.pageCount,
  });
  return c.json(DocumentResponse.parse({ document }), 201);
});

readingRoutes.get("/documents/:documentId", async (c) => {
  const { db } = c.get("services");
  const row = await getOwnedDocument(db, c.get("user").id, c.req.param("documentId"));
  if (!row) throw notFound("Document");
  return c.json(DocumentResponse.parse({ document: rowToDocument(row) }));
});

/** Paged text so large documents never travel whole. */
readingRoutes.get("/documents/:documentId/text", async (c) => {
  const { db } = c.get("services");
  const row = await getOwnedDocument(db, c.get("user").id, c.req.param("documentId"));
  if (!row) throw notFound("Document");
  const q = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(100).max(60_000).default(20_000) }).parse({ offset: c.req.query("offset"), limit: c.req.query("limit") });
  return c.json(DocumentTextResponse.parse({ text: row.content.slice(q.offset, q.offset + q.limit), offset: q.offset, total: row.content.length, pageStarts: row.pageStarts }));
});

readingRoutes.patch("/documents/:documentId", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, UpdateDocumentRequest);
  const document = await updateDocument(db, c.get("user").id, c.req.param("documentId"), body);
  if (!document) throw notFound("Document");
  return c.json(DocumentResponse.parse({ document }));
});

readingRoutes.delete("/documents/:documentId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteDocument(db, c.get("user").id, c.req.param("documentId")))) throw notFound("Document");
  return c.json({ ok: true });
});

readingRoutes.post("/documents/:documentId/ask", async (c) => {
  const { db, ai, env } = c.get("services");
  const user = c.get("user");
  const row = await getOwnedDocument(db, user.id, c.req.param("documentId"));
  if (!row) throw notFound("Document");
  const body = await parseBody(c, AskDocumentRequest);
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    const r = await askDocument(ai, row, body.question, body.range);
    return c.json(AskDocumentResponse.parse(r));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The reading companion is unavailable right now.", { code: err.code });
    throw err;
  }
});

readingRoutes.post("/documents/:documentId/generate", async (c) => {
  const { db, ai, env } = c.get("services");
  const user = c.get("user");
  const row = await getOwnedDocument(db, user.id, c.req.param("documentId"));
  if (!row) throw notFound("Document");
  const body = await parseBody(c, GenerateQuestionsRequest);
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  const r = await generateQuestions(ai, row, body.range);
  return c.json(GenerateQuestionsResponse.parse(r));
});

// ── Notes ───────────────────────────────────────────────────────────────────

readingRoutes.get("/notes", async (c) => {
  const { db } = c.get("services");
  const notes = await listNotes(db, c.get("user").id, c.req.query("documentId") || undefined);
  return c.json(NoteListResponse.parse({ notes }));
});

readingRoutes.post("/notes", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateNoteRequest);
  const note = await createNote(db, c.get("user").id, body);
  return c.json(NoteResponse.parse({ note }), 201);
});

readingRoutes.patch("/notes/:noteId", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, z.object({ content: z.string().min(1).max(20_000).optional(), conceptIds: z.array(z.string()).max(20).optional(), kind: z.enum(["note", "excerpt", "reflection", "question"]).optional() }));
  const note = await updateNote(db, c.get("user").id, c.req.param("noteId"), body);
  if (!note) throw notFound("Note");
  return c.json(NoteResponse.parse({ note }));
});

readingRoutes.delete("/notes/:noteId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteNote(db, c.get("user").id, c.req.param("noteId")))) throw notFound("Note");
  return c.json({ ok: true });
});

// ── Projects ────────────────────────────────────────────────────────────────

readingRoutes.post("/projects", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateProjectRequest);
  return c.json({ project: await createProject(db, c.get("user").id, body) }, 201);
});

readingRoutes.delete("/projects/:projectId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteProject(db, c.get("user").id, c.req.param("projectId")))) throw notFound("Project");
  return c.json({ ok: true });
});
