import { describe, expect, it } from "vitest";
import { competitorMission, launchMission } from "./missions";
import { EXERCISES, INVESTIGATIONS, SIMULATIONS, findExercise, listPublishedExercises, validateCurriculum, validateInvestigations, validateChallenges, validateMissions, validateNegotiations, validateSimulations } from "./index";

describe("negotiations and missions", () => {
  it("challenges validate", () => {
    const c = validateChallenges();
    if (!c.ok) console.error(c.errors);
    expect(c).toEqual({ ok: true });
  });
  it("validate", () => {
    const n = validateNegotiations();
    if (!n.ok) console.error(n.errors);
    expect(n).toEqual({ ok: true });
    const m = validateMissions();
    if (!m.ok) console.error(m.errors);
    expect(m).toEqual({ ok: true });
  });
  it("mission exercise steps reference real exercises", () => {
    for (const mission of [launchMission, competitorMission]) for (const s of mission.steps) if (s.exerciseId) expect(findExercise(s.exerciseId), s.exerciseId).not.toBeNull();
  });
});

describe("simulations", () => {
  it("validate: graph reachable, resources and sources consistent, at least one historical path", () => {
    const r = validateSimulations();
    if (!r.ok) console.error(r.errors);
    expect(r).toEqual({ ok: true });
    expect(SIMULATIONS.length).toBeGreaterThanOrEqual(2);
  });

  it("label every claim with a certainty and cite a source; mark counterfactual options", () => {
    for (const s of SIMULATIONS) {
      for (const c of s.public.claims) expect(c.sourceIds.length).toBeGreaterThan(0);
      for (const t of s.hidden.turns) for (const o of t.options) if (!o.historicalMatch) expect(o.counterfactualNote.length, `${s.public.id}/${o.id}`).toBeGreaterThan(0);
    }
  });
});

describe("investigations", () => {
  it("validate structurally and are solvable within budget", () => {
    const r = validateInvestigations();
    if (!r.ok) console.error(r.errors);
    expect(r).toEqual({ ok: true });
    expect(INVESTIGATIONS.length).toBeGreaterThanOrEqual(2);
  });
});

describe("curriculum", () => {
  it("validates every seed exercise", () => {
    const r = validateCurriculum();
    if (!r.ok) console.error(r.errors);
    expect(r).toEqual({ ok: true });
    expect(EXERCISES.length).toBeGreaterThanOrEqual(6);
  });

  it("covers the Phase 2 modes", () => {
    const modes = new Set(EXERCISES.map((e) => e.public.mode));
    for (const m of ["deductive_reasoning", "strategic_planning", "critical_thinking", "abductive_reasoning", "bayesian_reasoning", "negotiation"] as const) {
      expect(modes.has(m), m).toBe(true);
    }
  });

  it("exposes only public fields in the published list", () => {
    for (const e of listPublishedExercises()) {
      expect(e).not.toHaveProperty("solution");
      expect(e).not.toHaveProperty("hints");
      expect(e).not.toHaveProperty("rubric");
    }
  });

  it("finds by id", () => {
    expect(findExercise("ex-locked-archive")?.public.slug).toBe("locked-archive");
    expect(findExercise("nope")).toBeNull();
  });

  it("every hint ladder ends with a worked explanation longer than the first hint", () => {
    for (const e of EXERCISES) {
      expect(e.hidden.hints[4].length).toBeGreaterThan(e.hidden.hints[0].length);
    }
  });
});
