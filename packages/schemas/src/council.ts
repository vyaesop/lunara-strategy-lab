import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";

/**
 * War Room: multi-perspective council. Roles analyse independently; the user
 * decides. The council never votes or selects a winner.
 */
export const CouncilRole = z.enum(["strategist", "skeptic", "opponent", "operator", "auditor"]);
export type CouncilRole = z.infer<typeof CouncilRole>;
export const COUNCIL_ROLES = CouncilRole.options;

export const CouncilDepth = z.enum(["concise", "detailed"]);

/** Structured output contract shared by all roles; each role fills it from its own angle. */
export const RoleAnalysis = z.object({
  role: CouncilRole,
  /** One-paragraph position. */
  summary: MediumText,
  /** Specific points, each tagged by type. */
  points: z
    .array(
      z.object({
        kind: z.enum(["observation", "risk", "assumption", "question", "counter_move", "dependency", "unsupported_claim", "recommendation"]),
        text: z.string().max(600),
        /** How confident the role is in this point, 0..1; null when it is a question. */
        confidence: UnitInterval.nullable().default(null),
      }),
    )
    .min(1)
    .max(12),
  /** What the role would want to know before committing. */
  informationRequests: z.array(ShortText).max(5).default([]),
  /** Explicit uncertainty statement. */
  uncertainty: z.string().max(600).default(""),
});
export type RoleAnalysis = z.infer<typeof RoleAnalysis>;

export const CouncilExchange = z.object({
  id: DocumentId,
  /** null = the user; otherwise which role answered. */
  role: CouncilRole.nullable(),
  content: z.string().max(6000),
  /** Model id only. */
  model: z.string().max(120).nullable().default(null),
  at: IsoTimestamp,
});
export type CouncilExchange = z.infer<typeof CouncilExchange>;

export const CouncilDecision = z.object({
  decision: MediumText,
  rationale: LongText,
  accepted: z.array(z.string().max(300)).max(10).default([]),
  rejected: z.array(z.string().max(300)).max(10).default([]),
  toInvestigate: z.array(z.string().max(300)).max(10).default([]),
  confidence: UnitInterval,
  at: IsoTimestamp,
});
export type CouncilDecision = z.infer<typeof CouncilDecision>;

export const COUNCIL_SESSION_SCHEMA_VERSION = 1;

export const CouncilSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  title: ShortText,
  /** The problem or plan as the user stated it. */
  brief: LongText,
  /** Optional link to a scenario tree whose graph was included. */
  treeId: DocumentId.nullable().default(null),
  roles: z.array(CouncilRole).min(1).max(5),
  depth: CouncilDepth,
  status: z.enum(["analysing", "open", "decided", "abandoned"]),
  analyses: z.array(RoleAnalysis).max(5),
  /** Cross-critiques: what each role says about the others, generated once after analyses. */
  critiques: z.array(z.object({ role: CouncilRole, text: z.string().max(3000) })).max(5).default([]),
  exchanges: z.array(CouncilExchange).max(60).default([]),
  decision: CouncilDecision.nullable(),
  /** Provider usage summary for cost transparency. */
  usage: z.object({ calls: z.number().int().min(0), estimatedCostUsd: z.number().min(0), latencyMs: z.number().int().min(0) }),
});
export type CouncilSession = z.infer<typeof CouncilSession>;
