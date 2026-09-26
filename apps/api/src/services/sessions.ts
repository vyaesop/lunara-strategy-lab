import { and, asc, desc, eq } from "drizzle-orm";
import {
  CoachingSession,
  SESSION_SCHEMA_VERSION,
  SessionMessage,
  type SessionAssessment,
  type ExerciseDefinition,
  type SessionPhase,
  type UserHypothesis,
} from "@lunara/schemas";
import type { SessionState } from "@lunara/core";
import { releaseHiddenMaterial, type ReleasedMaterial } from "@lunara/core";
import type { Db } from "../db/client";
import { coachingSessions, sessionMessages } from "../db/schema";
import { newId } from "../ids";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToSession(row: typeof coachingSessions.$inferSelect): CoachingSession {
  return CoachingSession.parse({
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    id: row.id,
    uid: row.userId,
    exerciseId: row.exerciseId,
    exerciseVersion: row.exerciseVersion,
    mode: row.mode,
    status: row.status,
    phase: row.phase,
    hintLevel: row.hintLevel,
    revealed: row.revealed,
    hypotheses: row.hypotheses,
    decision: row.decision,
    assessment: row.assessment,
    messageCount: row.messageCount,
    startedAt: row.startedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    completedAt: iso(row.completedAt),
  });
}

export function rowToMessage(row: typeof sessionMessages.$inferSelect): SessionMessage {
  return SessionMessage.parse({
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    kind: row.kind,
    content: row.content,
    phase: row.phase,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toState(s: CoachingSession): SessionState {
  return {
    phase: s.phase,
    status: s.status,
    hintLevel: s.hintLevel,
    revealed: s.revealed,
    hypotheses: s.hypotheses,
    decision: s.decision,
  };
}

export async function createSession(db: Db, userId: string, exercise: ExerciseDefinition): Promise<CoachingSession> {
  const now = new Date();
  const [row] = await db
    .insert(coachingSessions)
    .values({
      id: newId("ses"),
      userId,
      schemaVersion: SESSION_SCHEMA_VERSION,
      exerciseId: exercise.public.id,
      exerciseVersion: exercise.public.version,
      mode: exercise.public.mode,
      status: "active",
      phase: "introduction",
      hintLevel: 0,
      revealed: false,
      hypotheses: [],
      decision: null,
      assessment: null,
      messageCount: 0,
      startedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rowToSession(row!);
}

/** Ownership is enforced in the query: a session belonging to another user is simply not found. */
export async function getOwnedSession(db: Db, userId: string, sessionId: string): Promise<CoachingSession | null> {
  const row = await db.query.coachingSessions.findFirst({
    where: and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, userId)),
  });
  return row ? rowToSession(row) : null;
}

export async function listSessions(db: Db, userId: string, limit = 50): Promise<CoachingSession[]> {
  const rows = await db
    .select()
    .from(coachingSessions)
    .where(eq(coachingSessions.userId, userId))
    .orderBy(desc(coachingSessions.lastActivityAt))
    .limit(limit);
  return rows.map(rowToSession);
}

export async function listMessages(db: Db, sessionId: string, limit = 200): Promise<SessionMessage[]> {
  const rows = await db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, sessionId))
    .orderBy(asc(sessionMessages.createdAt))
    .limit(limit);
  return rows.map(rowToMessage);
}

/** Persist a machine-produced state back to the row. */
export async function saveState(db: Db, sessionId: string, state: SessionState, extra: Partial<{ completedAt: Date }> = {}) {
  const now = new Date();
  const [row] = await db
    .update(coachingSessions)
    .set({
      phase: state.phase,
      status: state.status,
      hintLevel: state.hintLevel,
      revealed: state.revealed,
      hypotheses: state.hypotheses as UserHypothesis[],
      decision: state.decision,
      lastActivityAt: now,
      updatedAt: now,
      ...(extra.completedAt ? { completedAt: extra.completedAt } : {}),
    })
    .where(eq(coachingSessions.id, sessionId))
    .returning();
  return rowToSession(row!);
}

export async function saveAssessment(db: Db, sessionId: string, assessment: SessionAssessment): Promise<void> {
  await db.update(coachingSessions).set({ assessment, updatedAt: new Date() }).where(eq(coachingSessions.id, sessionId));
}

export async function appendMessage(
  db: Db,
  input: {
    sessionId: string;
    userId: string;
    role: SessionMessage["role"];
    kind: SessionMessage["kind"];
    content: string;
    phase: SessionPhase;
    model?: string | null;
  },
): Promise<SessionMessage> {
  const [row] = await db
    .insert(sessionMessages)
    .values({
      id: newId("msg"),
      sessionId: input.sessionId,
      userId: input.userId,
      role: input.role,
      kind: input.kind,
      content: input.content,
      phase: input.phase,
      model: input.model ?? null,
    })
    .returning();
  await db
    .update(coachingSessions)
    .set({ messageCount: (await countMessages(db, input.sessionId)), lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(coachingSessions.id, input.sessionId));
  return rowToMessage(row!);
}

async function countMessages(db: Db, sessionId: string): Promise<number> {
  const rows = await db.select({ id: sessionMessages.id }).from(sessionMessages).where(eq(sessionMessages.sessionId, sessionId));
  return rows.length;
}

export function released(session: CoachingSession, exercise: ExerciseDefinition): ReleasedMaterial {
  return releaseHiddenMaterial(toState(session), exercise.hidden);
}
