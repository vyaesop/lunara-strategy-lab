import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ── Better Auth core tables (field keys follow Better Auth's model names) ──

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ── Application tables ───────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  onboardingAnswers: jsonb("onboarding_answers"),
  preferences: jsonb("preferences").notNull().default(sql`'{}'::jsonb`),
  goals: jsonb("goals").notNull().default(sql`'[]'::jsonb`),
  stats: jsonb("stats").notNull().default(sql`'{}'::jsonb`),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const skillAssessments = pgTable(
  "skill_assessments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    skillId: text("skill_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    estimate: real("estimate").notNull(),
    unaidedEstimate: real("unaided_estimate"),
    confidence: real("confidence").notNull(),
    evidenceCount: integer("evidence_count").notNull().default(0),
    lastEvidenceAt: ts("last_evidence_at"),
    recentEvidence: jsonb("recent_evidence").notNull().default(sql`'[]'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

export const coachingSessions = pgTable(
  "coaching_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    exerciseId: text("exercise_id").notNull(),
    exerciseVersion: integer("exercise_version").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    phase: text("phase").notNull(),
    hintLevel: integer("hint_level").notNull().default(0),
    revealed: boolean("revealed").notNull().default(false),
    hypotheses: jsonb("hypotheses").notNull().default(sql`'[]'::jsonb`),
    decision: jsonb("decision"),
    assessment: jsonb("assessment"),
    messageCount: integer("message_count").notNull().default(0),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("coaching_sessions_user_status_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const sessionMessages = pgTable(
  "session_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => coachingSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    phase: text("phase").notNull(),
    model: text("model"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("session_messages_session_idx").on(t.sessionId, t.createdAt)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    ok: boolean("ok").notNull(),
    errorCode: text("error_code"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export const investigationSessions = pgTable(
  "investigation_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    investigationId: text("investigation_id").notNull(),
    investigationVersion: integer("investigation_version").notNull(),
    status: text("status").notNull(),
    pointsRemaining: integer("points_remaining").notNull(),
    revealedEvidenceIds: jsonb("revealed_evidence_ids").notNull().default(sql`'[]'::jsonb`),
    actionsTaken: jsonb("actions_taken").notNull().default(sql`'[]'::jsonb`),
    hypotheses: jsonb("hypotheses").notNull().default(sql`'[]'::jsonb`),
    confidenceHistory: jsonb("confidence_history").notNull().default(sql`'[]'::jsonb`),
    hintLevel: integer("hint_level").notNull().default(0),
    conclusion: jsonb("conclusion"),
    evaluation: jsonb("evaluation"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("investigation_sessions_user_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const scenarioTrees = pgTable(
  "scenario_trees",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    title: text("title").notNull(),
    objective: text("objective").notNull().default(""),
    context: jsonb("context").notNull().default(sql`'{"kind":"free","refId":null}'::jsonb`),
    version: integer("version").notNull().default(1),
    graph: jsonb("graph").notNull().default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    critiques: jsonb("critiques").notNull().default(sql`'[]'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("scenario_trees_user_idx").on(t.userId, t.updatedAt)],
);

export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    simulationId: text("simulation_id").notNull(),
    simulationVersion: integer("simulation_version").notNull(),
    status: text("status").notNull(),
    currentTurnId: text("current_turn_id"),
    resources: jsonb("resources").notNull().default(sql`'{}'::jsonb`),
    decisions: jsonb("decisions").notNull().default(sql`'[]'::jsonb`),
    revealedEvidenceIds: jsonb("revealed_evidence_ids").notNull().default(sql`'[]'::jsonb`),
    log: jsonb("log").notNull().default(sql`'[]'::jsonb`),
    hintLevel: integer("hint_level").notNull().default(0),
    evaluation: jsonb("evaluation"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("simulation_sessions_user_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const councilSessions = pgTable(
  "council_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    treeId: text("tree_id"),
    roles: jsonb("roles").notNull().default(sql`'[]'::jsonb`),
    depth: text("depth").notNull().default("concise"),
    status: text("status").notNull(),
    analyses: jsonb("analyses").notNull().default(sql`'[]'::jsonb`),
    critiques: jsonb("critiques").notNull().default(sql`'[]'::jsonb`),
    exchanges: jsonb("exchanges").notNull().default(sql`'[]'::jsonb`),
    decision: jsonb("decision"),
    usage: jsonb("usage").notNull().default(sql`'{"calls":0,"estimatedCostUsd":0,"latencyMs":0}'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("council_sessions_user_idx").on(t.userId, t.updatedAt)],
);

export const readingProjects = pgTable("reading_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  goal: text("goal").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const readingDocuments = pgTable(
  "reading_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    projectId: text("project_id").references(() => readingProjects.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    author: text("author").notNull().default(""),
    sourceUrl: text("source_url"),
    /** Extracted or pasted text. Served paged; never sent whole to a model. */
    content: text("content").notNull().default(""),
    /** Character offsets where each page starts (PDFs). */
    pageStarts: jsonb("page_starts").notNull().default(sql`'[]'::jsonb`),
    length: integer("length").notNull().default(0),
    pageCount: integer("page_count"),
    progress: real("progress").notNull().default(0),
    tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
    aiAllowed: boolean("ai_allowed").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("reading_documents_user_idx").on(t.userId, t.updatedAt)],
);

export const readingNotes = pgTable(
  "reading_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    documentId: text("document_id").references(() => readingDocuments.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => readingProjects.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    locator: text("locator"),
    range: jsonb("range"),
    conceptIds: jsonb("concept_ids").notNull().default(sql`'[]'::jsonb`),
    origin: text("origin").notNull().default("typed"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("reading_notes_user_doc_idx").on(t.userId, t.documentId, t.createdAt)],
);

export const knowledgeConcepts = pgTable(
  "knowledge_concepts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull().default(""),
    provenance: jsonb("provenance").notNull(),
    aliases: jsonb("aliases").notNull().default(sql`'[]'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("knowledge_concepts_user_slug_idx").on(t.userId, t.slug)],
);

export const knowledgeRelations = pgTable(
  "knowledge_relations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    fromId: text("from_id")
      .notNull()
      .references(() => knowledgeConcepts.id, { onDelete: "cascade" }),
    toId: text("to_id")
      .notNull()
      .references(() => knowledgeConcepts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    note: text("note").notNull().default(""),
    provenance: jsonb("provenance").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("knowledge_relations_user_idx").on(t.userId)],
);

export const reviewItems = pgTable(
  "review_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    kind: text("kind").notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    objective: text("objective").notNull().default(""),
    source: jsonb("source").notNull(),
    conceptIds: jsonb("concept_ids").notNull().default(sql`'[]'::jsonb`),
    skill: text("skill"),
    card: jsonb("card").notNull(),
    due: ts("due").notNull(),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    suspended: boolean("suspended").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("review_items_user_due_idx").on(t.userId, t.suspended, t.due)],
);

export const strategicProjects = pgTable(
  "strategic_projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    status: text("status").notNull().default("active"),
    sections: jsonb("sections").notNull().default(sql`'{}'::jsonb`),
    notes: text("notes").notNull().default(""),
    links: jsonb("links").notNull().default(sql`'{"treeIds":[],"councilIds":[],"documentIds":[]}'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("strategic_projects_user_idx").on(t.userId, t.updatedAt)],
);

export const decisionRecords = pgTable(
  "decision_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    projectId: text("project_id").references(() => strategicProjects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    context: text("context").notNull(),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    objective: text("objective").notNull(),
    alternatives: jsonb("alternatives").notNull().default(sql`'[]'::jsonb`),
    chosenAction: text("chosen_action").notNull(),
    rationale: text("rationale").notNull(),
    risks: jsonb("risks").notNull().default(sql`'[]'::jsonb`),
    confidence: real("confidence").notNull(),
    predictions: jsonb("predictions").notNull().default(sql`'[]'::jsonb`),
    actualOutcome: text("actual_outcome").notNull().default(""),
    lessons: text("lessons").notNull().default(""),
    status: text("status").notNull().default("open"),
    reviewAt: ts("review_at"),
    reviewedAt: ts("reviewed_at"),
    decidedAt: ts("decided_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("decision_records_user_idx").on(t.userId, t.status, t.reviewAt)],
);

export const dailyBriefings = pgTable(
  "daily_briefings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    payload: jsonb("payload").notNull(),
    responses: jsonb("responses").notNull().default(sql`'{}'::jsonb`),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const negotiationSessions = pgTable(
  "negotiation_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    negotiationId: text("negotiation_id").notNull(),
    negotiationVersion: integer("negotiation_version").notNull(),
    status: text("status").notNull(),
    round: integer("round").notNull().default(0),
    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    proposals: jsonb("proposals").notNull().default(sql`'[]'::jsonb`),
    preparation: jsonb("preparation").notNull().default(sql`'{"interests":"","batna":"","walkaway":null,"plan":""}'::jsonb`),
    outcome: jsonb("outcome"),
    evaluation: jsonb("evaluation"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("negotiation_sessions_user_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const customMissions = pgTable("custom_missions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  definition: jsonb("definition").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const missionSessions = pgTable(
  "mission_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    missionId: text("mission_id").notNull(),
    missionVersion: integer("mission_version").notNull(),
    definition: jsonb("definition").notNull(),
    status: text("status").notNull(),
    responses: jsonb("responses").notNull().default(sql`'[]'::jsonb`),
    debrief: jsonb("debrief"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("mission_sessions_user_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    gameId: text("game_id").notNull(),
    seed: integer("seed").notNull(),
    status: text("status").notNull(),
    state: jsonb("state").notNull(),
    evaluation: jsonb("evaluation"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("game_sessions_user_idx").on(t.userId, t.status, t.lastActivityAt)],
);

export const challengeAttempts = pgTable(
  "challenge_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull().default(1),
    challengeId: text("challenge_id").notNull(),
    challengeVersion: integer("challenge_version").notNull(),
    monthKey: text("month_key").notNull(),
    stage: text("stage").notNull(),
    status: text("status").notNull(),
    data: jsonb("data").notNull(),
    assessment: jsonb("assessment"),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("challenge_attempts_user_idx").on(t.userId, t.challengeId, t.startedAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profiles, { fields: [user.id], references: [profiles.userId] }),
  sessions: many(coachingSessions),
}));

export const coachingSessionRelations = relations(coachingSessions, ({ one, many }) => ({
  user: one(user, { fields: [coachingSessions.userId], references: [user.id] }),
  messages: many(sessionMessages),
}));

export const sessionMessageRelations = relations(sessionMessages, ({ one }) => ({
  session: one(coachingSessions, { fields: [sessionMessages.sessionId], references: [coachingSessions.id] }),
}));
