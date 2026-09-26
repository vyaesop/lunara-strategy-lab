import { describe, expect, it } from "vitest";
import type { InvestigationDefinition, InvestigationHypothesis } from "@lunara/schemas";
import { addHypothesis, conclude, evaluateDeterministic, initialState, performAction, requestHint, updateHypothesis } from "./engine";

const now = "2026-09-26T10:00:00.000Z";

const def: InvestigationDefinition = {
  public: {
    schemaVersion: 1, createdAt: now, updatedAt: now, id: "inv-t", slug: "inv-t", version: 1, status: "published", kind: "fictional",
    title: "T", summary: "s", difficulty: 2, estimatedMinutes: 20, learningObjectives: ["o"], briefing: "b", knownFacts: [],
    entities: [
      { id: "ent-a", name: "A", role: "suspect", description: "d", candidate: true },
      { id: "ent-b", name: "B", role: "suspect", description: "d", candidate: true },
      { id: "ent-w", name: "Witness", role: "witness", description: "d", candidate: false },
    ],
    actions: [
      { id: "act-1", label: "Interview witness", description: "d", kind: "interview", cost: 2, requiresEvidence: [] },
      { id: "act-2", label: "Lab report", description: "d", kind: "request_report", cost: 4, requiresEvidence: ["ev-2"] },
      { id: "act-3", label: "Search", description: "d", kind: "search", cost: 3, requiresEvidence: [] },
    ],
    budget: 6, expectedDimensions: ["evidence_evaluation"], tags: [],
  },
  hidden: {
    investigationId: "inv-t", version: 1,
    evidence: [
      { id: "ev-1", title: "Initial", content: "c", source: "s", kind: "observation", reliability: "high", initial: true },
      { id: "ev-2", title: "Witness says A", content: "c", source: "w", kind: "testimony", reliability: "low", initial: false },
      { id: "ev-3", title: "Lab: B's prints", content: "c", source: "lab", kind: "report", reliability: "high", initial: false },
      { id: "ev-4", title: "Search finds nothing", content: "c", source: "s", kind: "physical", reliability: "medium", initial: false },
    ],
    actionReveals: { "act-1": ["ev-2"], "act-2": ["ev-3"], "act-3": ["ev-4"] },
    groundTruth: { answerEntityId: "ent-b", summary: "B did it.", keyEvidenceIds: ["ev-1", "ev-3"], misleadingEvidenceIds: ["ev-2"] },
    rubric: [{ id: "r", title: "t", description: "d", weight: 1, skill: "evidence_evaluation", levels: [{ score: 0, descriptor: "a" }, { score: 1, descriptor: "b" }] }],
    hints: ["h1", "h2", "h3", "h4", "h5 worked"],
    debrief: "debrief",
  },
};

const hyp = (id: string, answer: string | null, links: InvestigationHypothesis["links"], confidence = 0.5): InvestigationHypothesis => ({
  id, statement: `${id} statement`, answerEntityId: answer, links, assumptions: [], confidence, status: "active", revisesId: null, createdAt: now, updatedAt: now,
});

const must = <T>(r: { ok: true; state: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("investigation engine", () => {
  it("starts with initial evidence and the full budget", () => {
    const s = initialState(def);
    expect(s.revealedEvidenceIds).toEqual(["ev-1"]);
    expect(s.pointsRemaining).toBe(6);
  });

  it("actions cost points, reveal evidence deterministically, and cannot repeat", () => {
    let s = initialState(def);
    s = must(performAction(s, def, "act-1", now));
    expect(s.pointsRemaining).toBe(4);
    expect(s.revealedEvidenceIds).toContain("ev-2");
    const again = performAction(s, def, "act-1", now);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("action_already_taken");
  });

  it("enforces prerequisites and budget", () => {
    const s = initialState(def);
    const early = performAction(s, def, "act-2", now);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe("prerequisite_missing");
    let s2 = must(performAction(s, def, "act-3", now)); // 3 left
    const tooDear = performAction(s2, def, "act-2", now);
    expect(tooDear.ok).toBe(false);
    s2 = must(performAction(s2, def, "act-1", now)); // 1 left, ev-2 revealed
    const still = performAction(s2, def, "act-2", now);
    expect(still.ok).toBe(false);
    if (!still.ok) expect(still.code).toBe("insufficient_points");
  });

  it("only allows links to revealed evidence and candidate entities", () => {
    const s = initialState(def);
    const bad = addHypothesis(s, def, hyp("h1", "ent-a", [{ evidenceId: "ev-3", relation: "supports", weight: 2 }]));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("evidence_not_revealed");
    const badEntity = addHypothesis(s, def, hyp("h1", "ent-w", []));
    expect(badEntity.ok).toBe(false);
    const ok = addHypothesis(s, def, hyp("h1", "ent-a", [{ evidenceId: "ev-1", relation: "supports", weight: 1 }]));
    expect(ok.ok).toBe(true);
  });

  it("tracks confidence history on updates", () => {
    let s = initialState(def);
    s = must(addHypothesis(s, def, hyp("h1", "ent-a", [], 0.4)));
    s = must(updateHypothesis(s, def, "h1", { confidence: 0.7 }, now));
    s = must(updateHypothesis(s, def, "h1", { assumptions: ["x"] }, now));
    expect(s.confidenceHistory.map((c) => c.confidence)).toEqual([0.4, 0.7]);
  });

  it("hints are sequential and the fifth needs an attempt", () => {
    const s = initialState(def);
    expect(requestHint(s, 2).ok).toBe(false);
    const s1 = must(requestHint(s, 1));
    expect(requestHint({ ...s1, hintLevel: 4 }, 5).ok).toBe(false);
  });

  it("concludes only with an active hypothesis and completes the session", () => {
    let s = initialState(def);
    expect(conclude(s, { hypothesisId: "nope", rationale: "r", confidence: 0.5, submittedAt: now }).ok).toBe(false);
    s = must(addHypothesis(s, def, hyp("h1", "ent-a", [])));
    s = must(conclude(s, { hypothesisId: "h1", rationale: "r", confidence: 0.9, submittedAt: now }));
    expect(s.status).toBe("completed");
    expect(performAction(s, def, "act-1", now).ok).toBe(false);
  });

  it("deterministic evaluation: coverage, contradiction awareness, misleading evidence", () => {
    let s = initialState(def);
    s = must(performAction(s, def, "act-1", now)); // ev-2 (misleading)
    s = must(performAction(s, def, "act-2", now)); // ev-3 (key)
    // Wrong conclusion that leans on the misleading testimony and ignores the lab report.
    s = must(addHypothesis(s, def, hyp("wrong", "ent-a", [
      { evidenceId: "ev-2", relation: "supports", weight: 3 },
      { evidenceId: "ev-1", relation: "supports", weight: 1 },
    ])));
    s = must(addHypothesis(s, def, hyp("right", "ent-b", [
      { evidenceId: "ev-3", relation: "supports", weight: 3 },
      { evidenceId: "ev-1", relation: "supports", weight: 2 },
    ])));
    const wrong = must(conclude(s, { hypothesisId: "wrong", rationale: "r", confidence: 0.8, submittedAt: now }));
    const ew = evaluateDeterministic(wrong, def);
    expect(ew.correct).toBe(false);
    expect(ew.evidenceCoverage).toBeCloseTo(0.5); // ev-1 linked, ev-3 not
    expect(ew.contradictionAwareness).toBe(0); // ev-1 linked as supports on a wrong hypothesis
    expect(ew.misledByCount).toBe(1);
    expect(ew.competingHypotheses).toBe(2);
    expect(ew.pointsUsed).toBe(6);

    const right = must(conclude(s, { hypothesisId: "right", rationale: "r", confidence: 0.8, submittedAt: now }));
    const er = evaluateDeterministic(right, def);
    expect(er.correct).toBe(true);
    expect(er.evidenceCoverage).toBe(1);
    expect(er.contradictionAwareness).toBe(1);
    expect(er.misledByCount).toBe(0);
    expect(er.missedKeyEvidenceIds).toEqual([]);
  });
});
