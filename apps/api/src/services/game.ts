import { and, desc, eq } from "drizzle-orm";
import type { ChatMessage, ModelRouter } from "@lunara/ai";
import { GAME_ID, GAME_SESSION_SCHEMA_VERSION, GameAssessmentDraft, GameEvaluation, GameSession, nowIso, type GameTurnInput, type GameView } from "@lunara/schemas";
import { aggregateRubric, buyPriceFor, deterministicGameMetrics, initialGameState, moraleBand, playMonth, reportsFor, skillScoresFromRubric } from "@lunara/core";
import type { RubricCriterion } from "@lunara/schemas";
import type { Db } from "../db/client";
import { gameSessions } from "../db/schema";
import { ApiHttpError, invalid } from "../errors";
import { newId } from "../ids";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const GAME_RUBRIC: RubricCriterion[] = [
  { id: "inventory", title: "Inventory discipline", description: "Bought to demand and capacity; avoided repeated stockouts and dead stock.", weight: 3, skill: "planning", levels: [{ score: 0, descriptor: "Chronic stockouts or overstock" }, { score: 0.5, descriptor: "Occasional" }, { score: 1, descriptor: "Matched buying to demand" }] },
  { id: "pricing", title: "Pricing and the rival", description: "Priced with the rival's response in mind rather than triggering a price war or gouging.", weight: 3, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "Provoked cuts or lost reputation to gouging" }, { score: 0.5, descriptor: "Mixed" }, { score: 1, descriptor: "Deliberate positioning with rationale" }] },
  { id: "resilience", title: "Resilience to events", description: "Kept a cash buffer and adapted after storms, fees and unrest.", weight: 2, skill: "risk_assessment", levels: [{ score: 0, descriptor: "Went broke or froze" }, { score: 0.5, descriptor: "Survived by luck" }, { score: 1, descriptor: "Buffered and adapted" }] },
  { id: "systems", title: "Feedback loops", description: "Recognised reputation and morale as compounding variables, not monthly costs.", weight: 2, skill: "systems_thinking", levels: [{ score: 0, descriptor: "Ignored" }, { score: 1, descriptor: "Invested and explained why" }] },
];

export function rowToGame(r: typeof gameSessions.$inferSelect): GameSession {
  return GameSession.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    id: r.id,
    uid: r.userId,
    gameId: r.gameId,
    seed: r.seed,
    status: r.status,
    state: r.state,
    evaluation: r.evaluation,
    startedAt: r.startedAt.toISOString(),
    lastActivityAt: r.lastActivityAt.toISOString(),
    completedAt: iso(r.completedAt),
  });
}

export async function createGame(db: Db, userId: string): Promise<GameSession> {
  const seed = Math.floor(Math.random() * 2_000_000_000);
  const now = new Date();
  const [row] = await db
    .insert(gameSessions)
    .values({ id: newId("game"), userId, schemaVersion: GAME_SESSION_SCHEMA_VERSION, gameId: GAME_ID, seed, status: "active", state: initialGameState(seed), evaluation: null, startedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now })
    .returning();
  return rowToGame(row!);
}

export async function getOwnedGame(db: Db, userId: string, id: string): Promise<GameSession | null> {
  const row = await db.query.gameSessions.findFirst({ where: and(eq(gameSessions.id, id), eq(gameSessions.userId, userId)) });
  return row ? rowToGame(row) : null;
}

export async function listGames(db: Db, userId: string) {
  const rows = await db.select().from(gameSessions).where(eq(gameSessions.userId, userId)).orderBy(desc(gameSessions.lastActivityAt)).limit(50);
  return rows.map(rowToGame).map((g) => ({ id: g.id, status: g.status, startedAt: g.startedAt, completedAt: g.completedAt, month: g.state.month, cash: g.state.cash, finalValue: g.evaluation?.finalValue ?? null }));
}

export function gameView(session: GameSession): GameView {
  const { morale, ...rest } = session.state;
  return {
    session: { ...session, state: { ...rest, moraleBand: moraleBand(morale) } },
    buyPrice: buyPriceFor(session.state),
    reports: reportsFor(session.state),
    lastMonth: session.state.history.at(-1) ?? null,
  };
}

export async function playTurn(db: Db, session: GameSession, input: GameTurnInput): Promise<GameSession> {
  if (session.status !== "active") throw new ApiHttpError("conflict", "Game is over");
  const r = playMonth(session.seed, session.state, input);
  if (!r.ok) throw invalid(r.reason);
  const ended = r.state.ended;
  const [row] = await db
    .update(gameSessions)
    .set({ state: r.state, status: ended ? "completed" : "active", ...(ended ? { completedAt: new Date() } : {}), lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(gameSessions.id, session.id))
    .returning();
  return rowToGame(row!);
}

export async function abandonGame(db: Db, session: GameSession): Promise<GameSession> {
  const [row] = await db.update(gameSessions).set({ status: "abandoned", updatedAt: new Date() }).where(eq(gameSessions.id, session.id)).returning();
  return rowToGame(row!);
}

export async function evaluateGame(db: Db, ai: ModelRouter, session: GameSession): Promise<GameSession> {
  if (session.status !== "completed") throw new ApiHttpError("conflict", "Finish the year first");
  if (session.evaluation) return session;
  const metrics = deterministicGameMetrics(session.state);
  const previous = (await db.select().from(gameSessions).where(and(eq(gameSessions.userId, session.uid), eq(gameSessions.status, "completed")))).map(rowToGame).filter((g) => g.id !== session.id && g.evaluation);
  const values = [...previous.map((g) => g.evaluation!.finalValue), metrics.finalValue].sort((a, b) => b - a);
  const personalRank = values.indexOf(metrics.finalValue) + 1;
  const example = GameAssessmentDraft.parse({
    criteria: GAME_RUBRIC.map((c) => ({ criterionId: c.id, score: 0.5, evidence: "Cite specific months and the player's rationales." })),
    strengths: ["One concrete strength"],
    weaknesses: ["One concrete gap"],
    debrief: "Two to four paragraphs on the player's decisions across the year, distinguishing judgement from luck.",
  });
  const months = session.state.history.map((m) => `M${m.month}: buy ${m.input.buyUnits}@${m.buyPrice}, sell @${m.input.sellPrice} (rival ${m.rivalPrice}, market ${m.marketPrice}), mkt ${m.input.marketing}, crew ${m.input.crewPay}${m.input.investWarehouse ? ", warehouse" : ""} → demand ${m.demand}, sold ${m.sold}, cash ${m.cashAfter}, rep ${m.reputationAfter}, event ${m.event.kind}${m.input.rationale ? ` | rationale: ${m.input.rationale}` : ""}`).join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are debriefing a player's year running a small trading company in a deterministic simulation. Judge the reasoning behind decisions using the rubric; the numbers are facts, not your judgement. Distinguish good outcomes from good decisions.",
        `RULES SUMMARY: demand falls with price relative to the rival (elasticity 1.6) and rises with reputation, marketing and morale; undercutting the rival by >10% for two months triggers a rival price cut; stockouts and gouging cost reputation; storms, port fees, demand surges and crew unrest occur at random.`,
        "RUBRIC:\n" + GAME_RUBRIC.map((c) => `- ${c.id} (weight ${c.weight}, skill ${c.skill}): ${c.title}. ${c.description}`).join("\n"),
        `METRICS: ${JSON.stringify(metrics)}`,
        `MONTHS:\n${months}`,
        "RESPOND WITH JSON ONLY:",
        `EXAMPLE_JSON:${JSON.stringify(example)}`,
        "END_EXAMPLE_JSON",
      ].join("\n\n"),
    },
    { role: "user", content: "Debrief the year." },
  ];
  const { value: draft } = await ai.generateStructured("coach.assess", GameAssessmentDraft, messages);
  const evaluation = GameEvaluation.parse({
    ...metrics,
    personalRank,
    personalRuns: values.length,
    criteria: draft.criteria,
    overallScore: aggregateRubric(GAME_RUBRIC, draft.criteria),
    skillScores: skillScoresFromRubric(GAME_RUBRIC, draft.criteria),
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    debrief: draft.debrief,
    assessedAt: nowIso(),
  });
  const [row] = await db.update(gameSessions).set({ evaluation, updatedAt: new Date() }).where(eq(gameSessions.id, session.id)).returning();
  return rowToGame(row!);
}
