import { z } from "zod";
import { DocumentId, LongText, MediumText, ShortText, UnitInterval } from "./common";
import { ExercisePublic } from "./exercise";
import {
  CoachingSession,
  HintLevel,
  SessionMessage,
  SessionPhase,
  UserHypothesis,
} from "./session";
import { SkillAssessment } from "./skills";
import { LearningGoal, OnboardingAnswers, UserPreferencesPatch, UserProfile } from "./user";
import { EvidenceItem, InvestigationHypothesis, InvestigationPublic, InvestigationSession } from "./investigation";
import { CritiqueMode, ScenarioTree, TreeCritique, TreeGraph } from "./tree";
import { SimulationPublic, SimulationSession, TurnView } from "./simulation";
import { COUNCIL_ROLES, CouncilDecision, CouncilDepth, CouncilRole, CouncilSession } from "./council";
import { GeneratedQuestions, KnowledgeConcept, KnowledgeRelation, ReadingDocument, ReadingNote, ReadingProject, RelationKind, ReviewItem, ReviewRating } from "./reading";
import { CalibrationSummary, DailyBriefing, DecisionRecord, Prediction, ProjectItem, ProjectSection, ProjectSuggestions, StrategicProject } from "./strategy";
import { NegotiationPublic, NegotiationSession, Proposal } from "./negotiation";
import { MissionDefinition, MissionSession, MissionStepKind } from "./mission";
import { GameSession, GameTurnInput } from "./game";
import { ChallengeAttempt, ChallengeData, ChallengeHypothesis, ChallengePrediction, ChallengePublic } from "./challenge";

/**
 * API v1 contracts shared by web and mobile clients and enforced by the
 * server. Every route validates its request body and its response.
 */

export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "unauthenticated",
      "forbidden",
      "not_found",
      "invalid_request",
      "conflict",
      "rate_limited",
      "budget_exceeded",
      "ai_unavailable",
      "internal",
    ]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
export type ApiErrorCode = ApiError["error"]["code"];

// ── /me ─────────────────────────────────────────────────────────────────────

export const MeResponse = z.object({
  profile: UserProfile,
  skills: z.array(SkillAssessment),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const UpdatePreferencesRequest = UserPreferencesPatch;
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;

export const CompleteOnboardingRequest = z.object({
  answers: OnboardingAnswers,
  preferences: UserPreferencesPatch.optional(),
});
export type CompleteOnboardingRequest = z.infer<typeof CompleteOnboardingRequest>;

export const UpsertGoalRequest = LearningGoal.omit({ createdAt: true }).partial({ id: true });
export type UpsertGoalRequest = z.infer<typeof UpsertGoalRequest>;

export const ProfileResponse = z.object({ profile: UserProfile });
export type ProfileResponse = z.infer<typeof ProfileResponse>;

// ── /exercises ──────────────────────────────────────────────────────────────

export const ExerciseListResponse = z.object({
  exercises: z.array(ExercisePublic),
});
export type ExerciseListResponse = z.infer<typeof ExerciseListResponse>;

export const ExerciseResponse = z.object({ exercise: ExercisePublic });
export type ExerciseResponse = z.infer<typeof ExerciseResponse>;

// ── /sessions ───────────────────────────────────────────────────────────────

export const CreateSessionRequest = z.object({ exerciseId: DocumentId });
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const SessionResponse = z.object({
  session: CoachingSession,
  messages: z.array(SessionMessage),
  exercise: ExercisePublic,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const SessionListResponse = z.object({
  sessions: z.array(CoachingSession),
});
export type SessionListResponse = z.infer<typeof SessionListResponse>;

export const SessionTurnRequest = z.object({
  content: z.string().trim().min(1).max(6_000),
});
export type SessionTurnRequest = z.infer<typeof SessionTurnRequest>;

export const SessionTurnResponse = z.object({
  session: CoachingSession,
  userMessage: SessionMessage,
  coachMessage: SessionMessage,
});
export type SessionTurnResponse = z.infer<typeof SessionTurnResponse>;

export const SubmitHypothesisRequest = UserHypothesis.omit({
  id: true,
  createdAt: true,
  status: true,
}).extend({
  /** When set, marks that hypothesis as revised by this one. */
  revisesId: DocumentId.nullable().optional(),
});
export type SubmitHypothesisRequest = z.infer<typeof SubmitHypothesisRequest>;

export const HintRequest = z.object({
  /** Must equal current hintLevel + 1; omitted = next level. */
  level: HintLevel.optional(),
});
export const HintResponse = z.object({
  session: CoachingSession,
  hint: SessionMessage,
});
export type HintResponse = z.infer<typeof HintResponse>;

export const SubmitDecisionRequest = z.object({
  text: MediumText,
  rationale: LongText,
  confidence: UnitInterval,
});
export type SubmitDecisionRequest = z.infer<typeof SubmitDecisionRequest>;

export const AdvancePhaseRequest = z.object({ to: SessionPhase });
export type AdvancePhaseRequest = z.infer<typeof AdvancePhaseRequest>;

export const SessionMutationResponse = z.object({ session: CoachingSession });
export type SessionMutationResponse = z.infer<typeof SessionMutationResponse>;

// ── /recommendations ────────────────────────────────────────────────────────

export const Recommendation = z.object({
  exercise: ExercisePublic,
  /** Plain-language explanation grounded in persisted evidence. */
  reason: z.string().max(400),
  /** Which rule produced it, for analytics and tests. */
  rule: z.enum(["repeated_error", "unattempted_focus", "weakest_skill", "unfamiliar_mode", "step_up", "unattempted", "practice_unaided"]),
});
export type Recommendation = z.infer<typeof Recommendation>;

export const RecommendationResponse = z.object({
  primary: Recommendation.nullable(),
  alternatives: z.array(Recommendation).max(3),
  /** Spaced-repetition items due now; shown before exercises when large. */
  reviewsDue: z.number().int().min(0).default(0),
  repeatedErrors: z.array(z.object({ pattern: z.string(), count: z.number().int() })).default([]),
});
export type RecommendationResponse = z.infer<typeof RecommendationResponse>;

// ── /investigations ─────────────────────────────────────────────────────────

export const InvestigationListResponse = z.object({ investigations: z.array(InvestigationPublic) });
export type InvestigationListResponse = z.infer<typeof InvestigationListResponse>;

/** Session view: state plus everything the state currently releases. */
export const InvestigationSessionView = z.object({
  session: InvestigationSession,
  investigation: InvestigationPublic,
  revealedEvidence: z.array(EvidenceItem),
  hints: z.array(z.string()),
  /** Available only after a conclusion. */
  groundTruth: z.object({ answerEntityId: DocumentId.nullable(), summary: z.string(), debrief: z.string() }).nullable(),
});
export type InvestigationSessionView = z.infer<typeof InvestigationSessionView>;

export const InvestigationSessionListResponse = z.object({ sessions: z.array(InvestigationSession) });

export const PerformActionRequest = z.object({ actionId: DocumentId });
export const UpsertInvestigationHypothesisRequest = InvestigationHypothesis.omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type UpsertInvestigationHypothesisRequest = z.infer<typeof UpsertInvestigationHypothesisRequest>;
export const ConcludeRequest = z.object({ hypothesisId: DocumentId, rationale: LongText, confidence: UnitInterval });
export type ConcludeRequest = z.infer<typeof ConcludeRequest>;

// ── /trees ──────────────────────────────────────────────────────────────────

export const TreeListResponse = z.object({
  trees: z.array(ScenarioTree.pick({ id: true, title: true, objective: true, version: true, updatedAt: true, createdAt: true, context: true }).extend({ nodeCount: z.number().int() })),
});
export type TreeListResponse = z.infer<typeof TreeListResponse>;
export const TreeResponse = z.object({ tree: ScenarioTree });
export type TreeResponse = z.infer<typeof TreeResponse>;
export const CreateTreeRequest = z.object({
  title: ShortText,
  objective: z.string().max(1_000).optional(),
  context: ScenarioTree.shape.context.optional(),
});
export const SaveTreeRequest = z.object({
  title: ShortText.optional(),
  objective: z.string().max(1_000).optional(),
  graph: TreeGraph,
  /** Version the client loaded; a mismatch means someone else saved first. */
  baseVersion: z.number().int().min(1),
});
export type SaveTreeRequest = z.infer<typeof SaveTreeRequest>;
export const CritiqueTreeRequest = z.object({ mode: CritiqueMode });
export const CritiqueTreeResponse = z.object({ tree: ScenarioTree, critique: TreeCritique });

// ── /simulations ────────────────────────────────────────────────────────────

export const SimulationListResponse = z.object({ simulations: z.array(SimulationPublic) });
export type SimulationListResponse = z.infer<typeof SimulationListResponse>;

export const SimulationSessionView = z.object({
  session: SimulationSession,
  simulation: SimulationPublic,
  turn: TurnView.nullable(),
  resources: z.array(z.object({ key: z.string(), label: z.string(), value: z.number().nullable(), band: z.enum(["low", "mid", "high"]).nullable() })),
  revealedEvidence: z.array(z.object({ id: z.string(), text: z.string() })),
  hints: z.array(z.string()),
  /** Released after completion. */
  historicalRecord: z.object({ decision: z.string(), outcome: z.string(), sourceIds: z.array(z.string()), debrief: z.string() }).nullable(),
  /** Text produced by the last decision, for immediate display. */
  narration: z.array(z.object({ kind: z.enum(["consequence", "counterfactual"]), text: z.string() })).default([]),
});
export type SimulationSessionView = z.infer<typeof SimulationSessionView>;

export const SimulationSessionListResponse = z.object({ sessions: z.array(SimulationSession) });
export const SimDecideRequest = z.object({ turnId: DocumentId, optionId: DocumentId, rationale: z.string().max(3000).default(""), confidence: UnitInterval.nullable().default(null) });
export type SimDecideRequest = z.infer<typeof SimDecideRequest>;

// ── /council ────────────────────────────────────────────────────────────────

export const CreateCouncilRequest = z.object({
  title: ShortText,
  brief: LongText,
  roles: z.array(CouncilRole).min(1).max(5).default([...COUNCIL_ROLES]),
  depth: CouncilDepth.default("concise"),
  treeId: DocumentId.nullable().default(null),
});
export type CreateCouncilRequest = z.infer<typeof CreateCouncilRequest>;
export const CouncilResponse = z.object({ council: CouncilSession });
export type CouncilResponse = z.infer<typeof CouncilResponse>;
export const CouncilListResponse = z.object({ councils: z.array(CouncilSession.pick({ id: true, title: true, status: true, roles: true, depth: true, createdAt: true, updatedAt: true })) });
export const CouncilAskRequest = z.object({ role: CouncilRole, question: z.string().trim().min(1).max(2000) });
export type CouncilAskRequest = z.infer<typeof CouncilAskRequest>;
export const CouncilDecideRequest = CouncilDecision.omit({ at: true });
export type CouncilDecideRequest = z.infer<typeof CouncilDecideRequest>;

// ── /reading, /knowledge, /review ───────────────────────────────────────────

export const CreateDocumentRequest = z.object({
  kind: z.enum(["note", "text", "markdown", "excerpt", "link"]),
  title: ShortText,
  content: z.string().max(2_000_000).default(""),
  author: z.string().max(200).default(""),
  sourceUrl: z.string().max(1000).nullable().default(null),
  projectId: DocumentId.nullable().default(null),
  tags: z.array(z.string().max(40)).max(12).default([]),
});
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequest>;
export const UpdateDocumentRequest = z.object({
  title: ShortText.optional(),
  author: z.string().max(200).optional(),
  progress: UnitInterval.optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  aiAllowed: z.boolean().optional(),
  projectId: DocumentId.nullable().optional(),
});
export const DocumentListResponse = z.object({ documents: z.array(ReadingDocument), projects: z.array(ReadingProject) });
export const DocumentResponse = z.object({ document: ReadingDocument });
export const DocumentTextResponse = z.object({ text: z.string(), offset: z.number().int(), total: z.number().int(), pageStarts: z.array(z.number().int()) });
export const CreateNoteRequest = ReadingNote.pick({ documentId: true, projectId: true, kind: true, content: true, locator: true, range: true, conceptIds: true, origin: true }).partial({ documentId: true, projectId: true, locator: true, range: true, conceptIds: true, origin: true });
export type CreateNoteRequest = z.infer<typeof CreateNoteRequest>;
export const NoteListResponse = z.object({ notes: z.array(ReadingNote) });
export const NoteResponse = z.object({ note: ReadingNote });
export const CreateProjectRequest = ReadingProject.pick({ title: true, description: true, goal: true }).partial({ description: true, goal: true });
export const AskDocumentRequest = z.object({ question: z.string().trim().min(1).max(2000), range: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }).nullable().default(null) });
export const AskDocumentResponse = z.object({ answer: z.string(), passage: z.object({ start: z.number().int(), end: z.number().int(), text: z.string() }), model: z.string() });
export const GenerateQuestionsRequest = z.object({ range: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }).nullable().default(null) });
export const GenerateQuestionsResponse = z.object({ generated: GeneratedQuestions, passage: z.object({ start: z.number().int(), end: z.number().int() }) });

export const CreateConceptRequest = KnowledgeConcept.pick({ name: true, kind: true, summary: true, aliases: true }).partial({ summary: true, aliases: true }).extend({
  documentId: DocumentId.nullable().default(null),
  origin: z.enum(["user", "ai_suggested"]).default("user"),
});
export const UpdateConceptRequest = KnowledgeConcept.pick({ name: true, kind: true, summary: true, aliases: true }).partial().extend({ confirmed: z.boolean().optional() });
export const CreateRelationRequest = z.object({ fromId: DocumentId, toId: DocumentId, kind: RelationKind, note: z.string().max(500).default("") });
export const KnowledgeGraphResponse = z.object({ concepts: z.array(KnowledgeConcept), relations: z.array(KnowledgeRelation) });
export const ConceptResponse = z.object({ concept: KnowledgeConcept, mergedInto: DocumentId.nullable().default(null) });

export const CreateReviewItemRequest = ReviewItem.pick({ kind: true, prompt: true, answer: true, objective: true, conceptIds: true, skill: true }).partial({ objective: true, conceptIds: true, skill: true }).extend({
  source: ReviewItem.shape.source.optional(),
});
export type CreateReviewItemRequest = z.infer<typeof CreateReviewItemRequest>;
export const ReviewQueueResponse = z.object({
  due: z.array(ReviewItem.extend({ preview: z.object({ again: z.number(), hard: z.number(), good: z.number(), easy: z.number() }) })),
  dueCount: z.number().int(),
  totalCount: z.number().int(),
  reviewedToday: z.number().int(),
});
export const GradeReviewRequest = z.object({ rating: ReviewRating, explanation: z.string().max(2000).nullable().default(null) });
export const ReviewItemResponse = z.object({ item: ReviewItem, intervalDays: z.number().int().optional() });
export const ReviewListResponse = z.object({ items: z.array(ReviewItem) });

// ── /projects, /journal, /briefing ──────────────────────────────────────────

export const CreateProjectRequestStrategy = z.object({ title: ShortText, summary: z.string().max(4000).default("") });
export const UpdateProjectRequest = z.object({
  title: ShortText.optional(),
  summary: z.string().max(4000).optional(),
  status: StrategicProject.shape.status.optional(),
  notes: z.string().max(20_000).optional(),
  links: StrategicProject.shape.links.optional(),
});
export const UpsertProjectItemRequest = z.object({ section: ProjectSection, id: DocumentId.optional(), text: MediumText, status: ProjectItem.shape.status.optional(), note: z.string().max(1000).optional() });
export const ProjectResponse = z.object({ project: StrategicProject });
export const ProjectListResponse = z.object({ projects: z.array(StrategicProject) });
export const ProjectSuggestResponse = z.object({ suggestions: ProjectSuggestions });

export const CreateDecisionRequest = DecisionRecord.pick({ projectId: true, title: true, context: true, evidence: true, objective: true, alternatives: true, chosenAction: true, rationale: true, risks: true, confidence: true, reviewAt: true }).partial({ projectId: true, evidence: true, alternatives: true, risks: true, reviewAt: true }).extend({
  predictions: z.array(Prediction.pick({ statement: true, probability: true, reasoning: true, invalidatingEvidence: true, reviewAt: true }).partial({ probability: true, reasoning: true, invalidatingEvidence: true, reviewAt: true })).max(10).default([]),
});
export type CreateDecisionRequest = z.infer<typeof CreateDecisionRequest>;
export const ReviewDecisionRequest = z.object({ actualOutcome: z.string().max(4000), lessons: z.string().max(4000).default("") });
export const ResolvePredictionRequest = z.object({ resolved: z.boolean(), resolutionNote: z.string().max(2000).default("") });
export const DecisionResponse = z.object({ decision: DecisionRecord });
export const DecisionListResponse = z.object({ decisions: z.array(DecisionRecord), calibration: CalibrationSummary });

export const BriefingResponse = z.object({ briefing: DailyBriefing, reviewItem: ReviewItem.nullable(), exercise: ExercisePublic.nullable() });
export const BriefingRespondRequest = z.object({
  puzzleAnswer: z.string().max(2000).nullable().optional(),
  puzzleCorrectSelf: z.boolean().nullable().optional(),
  strategicAnswer: z.string().max(4000).nullable().optional(),
  predictionText: z.string().max(2000).nullable().optional(),
});

// ── /negotiations, /missions ────────────────────────────────────────────────

export const NegotiationListResponse = z.object({ negotiations: z.array(NegotiationPublic) });
export const NegotiationSessionView = z.object({
  session: NegotiationSession,
  negotiation: NegotiationPublic,
  /** Counterpart's current offer on the table, if any. */
  currentOffer: Proposal.nullable(),
});
export type NegotiationSessionView = z.infer<typeof NegotiationSessionView>;
export const NegotiationSessionListResponse = z.object({ sessions: z.array(NegotiationSession) });
export const NegotiationPrepareRequest = NegotiationSession.shape.preparation.partial();
export const NegotiationSayRequest = z.object({ content: z.string().trim().min(1).max(3000) });
export const NegotiationProposeRequest = z.object({ terms: Proposal, message: z.string().max(2000).default("") });
export const NegotiationAcceptRequest = z.object({});

export const MissionListResponse = z.object({ missions: z.array(MissionDefinition) });
export const MissionSessionView = z.object({ session: MissionSession });
export const MissionSessionListResponse = z.object({ sessions: z.array(MissionSession) });
export const CreateCustomMissionRequest = z.object({
  title: ShortText,
  summary: MediumText,
  objectives: z.array(ShortText).min(1).max(6),
  constraints: z.array(MediumText).max(10).default([]),
  projectId: DocumentId.nullable().default(null),
  steps: z.array(z.object({ title: ShortText, kind: MissionStepKind, prompt: LongText, guidance: z.string().max(2000).default("") })).min(2).max(12),
});
export type CreateCustomMissionRequest = z.infer<typeof CreateCustomMissionRequest>;
export const MissionStepRespondRequest = z.object({ stepId: DocumentId, response: z.string().max(8000), refId: DocumentId.nullable().default(null) });

// ── /game, /challenges ──────────────────────────────────────────────────────

export const GameListResponse = z.object({ sessions: z.array(GameSession.pick({ id: true, status: true, startedAt: true, completedAt: true }).extend({ month: z.number().int(), cash: z.number(), finalValue: z.number().nullable() })) });
export const GameTurnRequest = GameTurnInput;

export const ChallengeListResponse = z.object({ challenges: z.array(ChallengePublic), attempts: z.array(ChallengeAttempt.pick({ id: true, challengeId: true, monthKey: true, stage: true, status: true, startedAt: true, completedAt: true }).extend({ overallScore: UnitInterval.nullable() })) });
export const ChallengeStageRequest = z.discriminatedUnion("stage", [
  z.object({ stage: z.literal("situation"), data: ChallengeData.shape.situation.unwrap().unwrap() }),
  z.object({ stage: z.literal("hypotheses"), data: z.array(ChallengeHypothesis.omit({ id: true })).min(2).max(8) }),
  z.object({ stage: z.literal("information"), actionId: DocumentId.optional(), done: z.boolean().default(false) }),
  z.object({ stage: z.literal("tree"), treeId: DocumentId.nullable() }),
  z.object({ stage: z.literal("anticipation"), data: z.array(ChallengePrediction).min(2).max(8) }),
  z.object({ stage: z.literal("strategy"), data: ChallengeData.shape.strategy.unwrap().unwrap() }),
  z.object({ stage: z.literal("decision"), data: ChallengeData.shape.decision.unwrap().unwrap() }),
  z.object({ stage: z.literal("adversarial"), answers: z.array(z.string().max(4000)).min(1).max(5) }),
]);
export type ChallengeStageRequest = z.infer<typeof ChallengeStageRequest>;

// ── /ai ─────────────────────────────────────────────────────────────────────

export const AIHealthResponse = z.object({
  provider: z.string(),
  model: z.string(),
  ok: z.boolean(),
  latencyMs: z.number().int().min(0),
  /** True when running against the deterministic mock provider. */
  mock: z.boolean(),
});
export type AIHealthResponse = z.infer<typeof AIHealthResponse>;
