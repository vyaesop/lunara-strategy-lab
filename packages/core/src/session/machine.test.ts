import { describe, expect, it } from "vitest";
import type { ExerciseHidden, UserHypothesis } from "@lunara/schemas";
import {
  abandon,
  canRequestHint,
  canTransition,
  complete,
  releaseHiddenMaterial,
  requestReveal,
  submitDecision,
  submitHypothesis,
  type SessionState,
} from "./machine";

const now = "2026-09-25T12:00:00.000Z";

const fresh = (): SessionState => ({
  phase: "introduction",
  status: "active",
  hintLevel: 0,
  revealed: false,
  hypotheses: [],
  decision: null,
});

const hyp = (id = "h1", revisesId: string | null = null): UserHypothesis => ({
  id,
  statement: "The courier left before dawn.",
  supportingEvidence: ["Wet boots"],
  contradictingEvidence: [],
  assumptions: ["Rain stopped at 5am"],
  confidence: 0.6,
  status: "active",
  revisesId,
  createdAt: now,
});

const hidden: ExerciseHidden = {
  exerciseId: "ex-1",
  version: 1,
  solution: "SOLUTION",
  keyInsights: ["INSIGHT"],
  commonErrors: [],
  rubric: [],
  hints: ["H1", "H2", "H3", "H4", "H5"],
  debrief: "DEBRIEF",
};

const must = <T>(r: { ok: true; state: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("phase transitions", () => {
  it("allows one step forward", () => {
    const s = must(canTransition(fresh(), "initial_understanding"));
    expect(s.phase).toBe("initial_understanding");
  });

  it("rejects skipping phases", () => {
    const r = canTransition(fresh(), "final_decision");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("illegal_transition");
  });

  it("requires an attempt before final decision", () => {
    const s: SessionState = { ...fresh(), phase: "revision" };
    const r = canTransition(s, "final_decision");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("missing_hypothesis");
    const withHyp = { ...s, hypotheses: [hyp()] };
    expect(canTransition(withHyp, "final_decision").ok).toBe(true);
  });

  it("requires a decision or reveal before debrief", () => {
    const s: SessionState = { ...fresh(), phase: "final_decision", hypotheses: [hyp()] };
    expect(canTransition(s, "debrief").ok).toBe(false);
    expect(canTransition({ ...s, revealed: true }, "debrief").ok).toBe(true);
  });

  it("permits explicit backward loops only", () => {
    expect(canTransition({ ...fresh(), phase: "evidence_challenge" }, "hypothesis").ok).toBe(true);
    expect(canTransition({ ...fresh(), phase: "revision" }, "evidence_challenge").ok).toBe(true);
    expect(canTransition({ ...fresh(), phase: "final_decision" }, "hypothesis").ok).toBe(false);
  });

  it("refuses everything once abandoned", () => {
    const s = must(abandon(fresh()));
    expect(canTransition(s, "initial_understanding").ok).toBe(false);
    expect(canRequestHint(s, 1).ok).toBe(false);
  });
});

describe("hints", () => {
  it("are sequential", () => {
    const s: SessionState = { ...fresh(), phase: "hypothesis" };
    expect(canRequestHint(s, 2).ok).toBe(false);
    const s1 = must(canRequestHint(s, 1));
    expect(s1.hintLevel).toBe(1);
    expect(canRequestHint(s1, 1).ok).toBe(false);
    expect(canRequestHint(s1, 2).ok).toBe(true);
  });

  it("level 5 requires a genuine attempt and counts as a reveal", () => {
    const s: SessionState = { ...fresh(), phase: "revision", hintLevel: 4 };
    expect(canRequestHint(s, 5).ok).toBe(false);
    const s5 = must(canRequestHint({ ...s, hypotheses: [hyp()] }, 5));
    expect(s5.revealed).toBe(true);
  });

  it("are unavailable in introduction and after debrief", () => {
    expect(canRequestHint(fresh(), 1).ok).toBe(false);
    expect(canRequestHint({ ...fresh(), phase: "debrief" }, 1).ok).toBe(false);
  });
});

describe("hypotheses and decisions", () => {
  it("auto-advances from initial understanding on first hypothesis", () => {
    const s = must(submitHypothesis({ ...fresh(), phase: "initial_understanding" }, hyp()));
    expect(s.phase).toBe("hypothesis");
    expect(s.hypotheses).toHaveLength(1);
  });

  it("marks revised hypotheses", () => {
    let s = must(submitHypothesis({ ...fresh(), phase: "hypothesis" }, hyp("h1")));
    s = must(submitHypothesis(s, hyp("h2", "h1")));
    expect(s.hypotheses.find((h) => h.id === "h1")?.status).toBe("revised");
    expect(s.hypotheses.find((h) => h.id === "h2")?.status).toBe("active");
  });

  it("rejects hypotheses during final decision", () => {
    expect(submitHypothesis({ ...fresh(), phase: "final_decision" }, hyp()).ok).toBe(false);
  });

  it("records a decision only in final_decision and moves to debrief", () => {
    const decision = { text: "Go", rationale: "Because", confidence: 0.7, submittedAt: now };
    expect(submitDecision({ ...fresh(), phase: "hypothesis" }, decision).ok).toBe(false);
    const s = must(submitDecision({ ...fresh(), phase: "final_decision", hypotheses: [hyp()] }, decision));
    expect(s.phase).toBe("debrief");
    expect(s.decision).toEqual(decision);
  });

  it("completes only from skill_update", () => {
    expect(complete({ ...fresh(), phase: "debrief" }).ok).toBe(false);
    const s = must(complete({ ...fresh(), phase: "skill_update" }));
    expect(s.status).toBe("completed");
    expect(s.phase).toBe("completed");
  });
});

describe("reveal and hidden-material release", () => {
  it("reveal requires an attempt", () => {
    expect(requestReveal({ ...fresh(), phase: "hypothesis" }).ok).toBe(false);
    const s = must(requestReveal({ ...fresh(), phase: "hypothesis", hypotheses: [hyp()] }));
    expect(s.revealed).toBe(true);
  });

  it("releases only earned hints and never the solution early", () => {
    const s: SessionState = { ...fresh(), phase: "evidence_challenge", hintLevel: 2, hypotheses: [hyp()] };
    const m = releaseHiddenMaterial(s, hidden);
    expect(m.hints).toEqual(["H1", "H2"]);
    expect(m.solution).toBeNull();
    expect(m.keyInsights).toBeNull();
    expect(m.debrief).toBeNull();
  });

  it("releases solution after a decision and debrief in the debrief phase", () => {
    const decided: SessionState = {
      ...fresh(),
      phase: "debrief",
      hypotheses: [hyp()],
      decision: { text: "Go", rationale: "Because", confidence: 0.7, submittedAt: now },
    };
    const m = releaseHiddenMaterial(decided, hidden);
    expect(m.solution).toBe("SOLUTION");
    expect(m.keyInsights).toEqual(["INSIGHT"]);
    expect(m.debrief).toBe("DEBRIEF");
  });

  it("releases solution but not debrief after an early reveal", () => {
    const s: SessionState = { ...fresh(), phase: "revision", revealed: true, hypotheses: [hyp()] };
    const m = releaseHiddenMaterial(s, hidden);
    expect(m.solution).toBe("SOLUTION");
    expect(m.debrief).toBeNull();
  });
});
