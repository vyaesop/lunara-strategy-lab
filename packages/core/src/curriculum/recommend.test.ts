import { describe, expect, it } from "vitest";
import type { CoachingSession, ExercisePublic, SkillAssessment, UserPreferences } from "@lunara/schemas";
import { recommend } from "./recommend";

const now = "2026-09-25T12:00:00.000Z";
const ex = (id: string, mode: ExercisePublic["mode"], difficulty: number, dims: ExercisePublic["expectedDimensions"]): ExercisePublic => ({
  schemaVersion: 1, createdAt: now, updatedAt: now, id, slug: id, version: 1, status: "published", source: "curated",
  title: id, summary: "s", mode, difficulty, answerKind: "open", estimatedMinutes: 10, learningObjectives: ["o"],
  scenario: "sc", facts: [], constraints: [], expectedDimensions: dims, tags: [],
});
const session = (exerciseId: string, mode: CoachingSession["mode"], score: number, hintLevel = 0): CoachingSession => ({
  schemaVersion: 1, createdAt: now, updatedAt: now, id: `s-${exerciseId}`, uid: "u", exerciseId, exerciseVersion: 1, mode,
  status: "completed", phase: "completed", hintLevel, revealed: false, hypotheses: [], decision: null, messageCount: 0,
  startedAt: now, lastActivityAt: now, completedAt: now,
  assessment: {
    overallScore: score, unaidedScore: score, hintLevelUsed: hintLevel, revealedBeforeDecision: false,
    criteria: [{ criterionId: "c", score, evidence: "e" }], skillScores: [{ skillId: "planning", score }],
    correct: null, outcomeQuality: "not_applicable", strengths: [], weaknesses: [], errorPatterns: [], debrief: "d", assessedAt: now,
  },
});
const skill = (skillId: SkillAssessment["skillId"], estimate: number, evidenceCount: number): SkillAssessment => ({
  schemaVersion: 1, createdAt: now, updatedAt: now, skillId, estimate, unaidedEstimate: null, confidence: 0.5, evidenceCount, lastEvidenceAt: now, recentEvidence: [],
});
const prefs = (focusModes: UserPreferences["focusModes"] = []): UserPreferences => ({
  coachingIntensity: "balanced", sessionLength: "standard", theme: "system", notifications: { dailyBriefing: false, reviewReminders: false }, focusModes,
});

const catalog = [
  ex("ded-1", "deductive_reasoning", 2, ["logical_validity"]),
  ex("plan-1", "strategic_planning", 3, ["planning", "risk_assessment"]),
  ex("crit-1", "critical_thinking", 2, ["evidence_evaluation"]),
  ex("plan-2", "strategic_planning", 4, ["planning"]),
];

describe("recommend", () => {
  it("new user: lowest difficulty unattempted, with a reason", () => {
    const r = recommend({ exercises: catalog, sessions: [], skills: [], preferences: prefs() });
    expect(r[0]!.exercise.id).toBe("ded-1");
    expect(r[0]!.rule).toBe("unattempted");
    expect(r[0]!.reason).toMatch(/not attempted/);
  });

  it("prefers focus modes for new users", () => {
    const r = recommend({ exercises: catalog, sessions: [], skills: [], preferences: prefs(["strategic_planning"]) });
    expect(r[0]!.exercise.id).toBe("plan-1");
    expect(r[0]!.rule).toBe("unattempted_focus");
  });

  it("targets the weakest evidenced skill above focus preferences", () => {
    const r = recommend({
      exercises: catalog,
      sessions: [session("ded-1", "deductive_reasoning", 0.4)],
      skills: [skill("evidence_evaluation", 0.3, 2), skill("logical_validity", 0.8, 3)],
      preferences: prefs(["strategic_planning"]),
    });
    expect(r[0]!.exercise.id).toBe("crit-1");
    expect(r[0]!.rule).toBe("weakest_skill");
    expect(r[0]!.reason).toMatch(/evidence evaluation/i);
  });

  it("ignores skills with too little evidence", () => {
    const r = recommend({ exercises: catalog, sessions: [], skills: [skill("evidence_evaluation", 0.1, 1)], preferences: prefs() });
    expect(r[0]!.rule).toBe("unattempted");
  });

  it("exposes unfamiliar modes after three completed sessions", () => {
    const sessions = [session("plan-1", "strategic_planning", 0.5), session("plan-2", "strategic_planning", 0.5), session("ded-1", "deductive_reasoning", 0.5)];
    const r = recommend({ exercises: catalog, sessions, skills: [], preferences: prefs() });
    expect(r[0]!.exercise.id).toBe("crit-1");
    expect(r[0]!.rule).toBe("unfamiliar_mode");
  });

  it("steps up difficulty when recent scores are high", () => {
    const sessions = [session("plan-1", "strategic_planning", 0.9), session("ded-1", "deductive_reasoning", 0.8)];
    const r = recommend({ exercises: catalog, sessions, skills: [], preferences: prefs() });
    const stepUp = r.find((x) => x.rule === "step_up");
    expect(stepUp?.exercise.id).toBe("plan-2");
  });

  it("falls back to unaided practice when everything is attempted", () => {
    const sessions = catalog.map((e) => session(e.id, e.mode, 0.6, e.id === "plan-1" ? 3 : 0));
    const r = recommend({ exercises: catalog, sessions, skills: [], preferences: prefs() });
    expect(r).toHaveLength(1);
    expect(r[0]!.rule).toBe("practice_unaided");
    expect(r[0]!.exercise.id).toBe("plan-1");
    expect(r[0]!.reason).toMatch(/3 hints/);
  });

  it("targets repeated error patterns first", () => {
    const withPattern = (id: string, mode: CoachingSession["mode"]) => {
      const s = session(id, mode, 0.5);
      s.assessment!.errorPatterns = ["premature_commitment"];
      return s;
    };
    const r = recommend({ exercises: catalog, sessions: [withPattern("plan-1", "strategic_planning"), withPattern("ded-1", "deductive_reasoning")], skills: [], preferences: prefs() });
    expect(r[0]!.rule).toBe("repeated_error");
    expect(r[0]!.exercise.id).toBe("plan-2");
    expect(r[0]!.reason).toMatch(/premature commitment/);
  });

  it("never recommends the same exercise twice and respects the limit", () => {
    const r = recommend({ exercises: catalog, sessions: [], skills: [], preferences: prefs(["deductive_reasoning"]) }, 2);
    expect(new Set(r.map((x) => x.exercise.id)).size).toBe(r.length);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
