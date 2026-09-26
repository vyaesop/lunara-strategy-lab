import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { CriterionEvaluation } from "./session";
import { SkillId } from "./skills";

/**
 * Strategy management game: one tightly scoped scenario, deterministic
 * rules with a seeded random stream. AI only narrates the final debrief.
 */
export const GAME_ID = "game-meridian-trading";
export const GAME_MONTHS = 12;

export const GameEvent = z.object({
  month: z.number().int().min(1),
  kind: z.enum(["storm", "port_fee", "rival_cut", "demand_surge", "crew_unrest", "none"]),
  text: ShortText,
});
export type GameEvent = z.infer<typeof GameEvent>;

export const GameTurnInput = z.object({
  /** Units to buy at the current buy price. */
  buyUnits: z.number().int().min(0).max(5000),
  /** Your sell price per unit. */
  sellPrice: z.number().min(1).max(500),
  /** Marketing spend this month. */
  marketing: z.number().min(0).max(50_000),
  /** Invest in warehouse capacity this month (one-off). */
  investWarehouse: z.boolean().default(false),
  /** Crew pay level: 0 austerity, 1 normal, 2 generous. */
  crewPay: z.number().int().min(0).max(2).default(1),
  rationale: z.string().max(2000).default(""),
});
export type GameTurnInput = z.infer<typeof GameTurnInput>;

export const GameMonthRecord = z.object({
  month: z.number().int().min(1),
  input: GameTurnInput,
  buyPrice: z.number(),
  marketPrice: z.number(),
  rivalPrice: z.number(),
  demand: z.number().int(),
  sold: z.number().int(),
  revenue: z.number(),
  costs: z.number(),
  cashAfter: z.number(),
  inventoryAfter: z.number().int(),
  reputationAfter: z.number(),
  event: GameEvent,
});
export type GameMonthRecord = z.infer<typeof GameMonthRecord>;

export const GameState = z.object({
  month: z.number().int().min(1).max(GAME_MONTHS + 1),
  cash: z.number(),
  inventory: z.number().int().min(0),
  capacity: z.number().int().min(0),
  reputation: z.number().min(0).max(100),
  /** Hidden from the player as a number; shown as a band. */
  morale: z.number().min(0).max(100),
  marketPrice: z.number(),
  rivalPrice: z.number(),
  /** Months in a row you undercut the rival by >10%. */
  undercutStreak: z.number().int().min(0),
  history: z.array(GameMonthRecord).max(GAME_MONTHS),
  ended: z.boolean(),
});
export type GameState = z.infer<typeof GameState>;

export const GameReport = z.object({
  throughMonth: z.number().int(),
  profit: z.number(),
  avgMargin: z.number(),
  stockoutMonths: z.number().int(),
  reputationChange: z.number(),
  note: ShortText,
});
export type GameReport = z.infer<typeof GameReport>;

export const GameEvaluation = z.object({
  finalCash: z.number(),
  finalValue: z.number(),
  profit: z.number(),
  avgMargin: z.number(),
  stockoutMonths: z.number().int(),
  reputationEnd: z.number(),
  moraleEnd: z.number(),
  eventsSurvived: z.number().int(),
  /** Rank versus the user's own previous runs (1 = best), not against other users. */
  personalRank: z.number().int().min(1),
  personalRuns: z.number().int().min(1),
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type GameEvaluation = z.infer<typeof GameEvaluation>;

export const GAME_SESSION_SCHEMA_VERSION = 1;

export const GameSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  gameId: z.string(),
  seed: z.number().int(),
  status: z.enum(["active", "completed", "abandoned"]),
  state: GameState,
  evaluation: GameEvaluation.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type GameSession = z.infer<typeof GameSession>;

/** Player-facing view: morale as a band, plus what the player can see about the market. */
export const GameView = z.object({
  session: GameSession.omit({ state: true }).extend({
    state: GameState.omit({ morale: true }).extend({ moraleBand: z.enum(["low", "mid", "high"]) }),
  }),
  buyPrice: z.number(),
  reports: z.array(GameReport),
  /** Narration for the last month. */
  lastMonth: GameMonthRecord.nullable(),
});
export type GameView = z.infer<typeof GameView>;

export const GameAssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  debrief: LongText,
});
