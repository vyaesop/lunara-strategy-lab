import { describe, expect, it } from "vitest";
import type { SimulationDefinition } from "@lunara/schemas";
import { decide, initialSimState, requestSimHint, turnView, validateSimulation, visibleResources } from "./engine";

const now = "2026-09-26T10:00:00.000Z";

const def: SimulationDefinition = {
  public: {
    schemaVersion: 1, createdAt: now, updatedAt: now, id: "sim-t", slug: "sim-t", version: 1, status: "published",
    title: "T", figure: "F", period: "P", summary: "s", difficulty: 2, estimatedMinutes: 20, learningObjectives: ["o"],
    background: "b", role: "r",
    resources: [
      { key: "gold", label: "Gold", description: "", initial: 10, min: 0, max: 100, visible: true },
      { key: "morale", label: "Morale", description: "", initial: 50, min: 0, max: 100, visible: false },
    ],
    sources: [{ id: "src-1", title: "Book", author: "A", publication: "", year: 2000, url: null, locator: null, type: "book", verification: "verified", note: "" }],
    claims: [{ id: "cl-1", text: "claim", certainty: "established", sourceIds: ["src-1"] }],
    expectedDimensions: ["decision_quality"], tags: [],
  },
  hidden: {
    simulationId: "sim-t", version: 1,
    turns: [
      {
        id: "t1", title: "One", situation: "sit1", intelligence: ["intel"], hidden: ["secret"], terminal: false,
        options: [
          { id: "a", label: "A", description: "d", requires: [], effects: [{ resource: "gold", delta: -4 }], reveals: ["ev-x"], historicalMatch: true, counterfactualNote: "", consequence: { narration: "cons A", effects: [{ resource: "morale", delta: 20 }], nextTurnId: null } },
          { id: "b", label: "B", description: "d", requires: [{ resource: "gold", op: ">=", value: 20 }], effects: [], reveals: [], historicalMatch: false, counterfactualNote: "This departs from the record.", consequence: null },
          { id: "c", label: "C", description: "d", requires: [], effects: [{ resource: "gold", delta: -50 }], reveals: [], historicalMatch: false, counterfactualNote: "cf", consequence: { narration: "jump", effects: [], nextTurnId: "t3" } },
        ],
      },
      { id: "t2", title: "Two", situation: "sit2", intelligence: [], hidden: [], terminal: true, options: [
        { id: "d", label: "D", description: "d", requires: [], effects: [], reveals: [], historicalMatch: true, counterfactualNote: "", consequence: null },
        { id: "e", label: "E", description: "d", requires: [], effects: [], reveals: [], historicalMatch: false, counterfactualNote: "", consequence: null },
      ] },
      { id: "t3", title: "Three", situation: "sit3", intelligence: [], hidden: [], terminal: true, options: [
        { id: "f", label: "F", description: "d", requires: [], effects: [], reveals: [], historicalMatch: false, counterfactualNote: "", consequence: null },
        { id: "g", label: "G", description: "d", requires: [], effects: [], reveals: [], historicalMatch: false, counterfactualNote: "", consequence: null },
      ] },
    ],
    evidence: { "ev-x": "evidence x" },
    historicalRecord: { decision: "hd", outcome: "ho", sourceIds: ["src-1"] },
    rubric: [{ id: "r", title: "t", description: "d", weight: 1, skill: "decision_quality", levels: [{ score: 0, descriptor: "a" }, { score: 1, descriptor: "b" }] }],
    debrief: "debrief",
  },
};

const must = <T>(r: { ok: true; state: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("simulation engine", () => {
  it("validates the definition", () => {
    expect(validateSimulation(def)).toEqual([]);
  });

  it("starts at the first turn with initial resources and the situation logged", () => {
    const s = initialSimState(def, now);
    expect(s.currentTurnId).toBe("t1");
    expect(s.resources).toEqual({ gold: 10, morale: 50 });
    expect(s.log[0]!.kind).toBe("situation");
  });

  it("strips hidden facts and computes availability in the turn view", () => {
    const v = turnView(def, initialSimState(def, now))!;
    expect(JSON.stringify(v)).not.toContain("secret");
    expect(JSON.stringify(v)).not.toContain("effects");
    expect(v.options.find((o) => o.id === "b")!.available).toBe(false);
    expect(v.options.find((o) => o.id === "a")!.available).toBe(true);
  });

  it("hides invisible resources behind a band", () => {
    const vr = visibleResources(def, { gold: 10, morale: 90 });
    expect(vr.find((r) => r.key === "gold")).toMatchObject({ value: 10, band: null });
    expect(vr.find((r) => r.key === "morale")).toMatchObject({ value: null, band: "high" });
  });

  it("applies effects and consequence, clamps, reveals evidence, advances in order", () => {
    const s0 = initialSimState(def, now);
    const out = must(decide(def, s0, { turnId: "t1", optionId: "a", rationale: "r", confidence: 0.6, at: now }));
    expect(out.state.resources).toEqual({ gold: 6, morale: 70 });
    expect(out.state.currentTurnId).toBe("t2");
    expect(out.state.revealedEvidenceIds).toEqual(["ev-x"]);
    expect(out.narration.map((n) => n.kind)).toEqual(["consequence"]);
    expect(out.state.decisions[0]!.historicalMatch).toBe(true);
    expect(out.state.log.at(-1)!.text).toBe("sit2");
  });

  it("refuses unavailable options and wrong turns", () => {
    const s0 = initialSimState(def, now);
    expect(decide(def, s0, { turnId: "t1", optionId: "b", rationale: "", confidence: null, at: now }).ok).toBe(false);
    expect(decide(def, s0, { turnId: "t2", optionId: "d", rationale: "", confidence: null, at: now }).ok).toBe(false);
  });

  it("labels counterfactual branches, clamps at min, and follows explicit jumps", () => {
    const out = must(decide(def, initialSimState(def, now), { turnId: "t1", optionId: "c", rationale: "", confidence: null, at: now }));
    expect(out.state.resources.gold).toBe(0);
    expect(out.narration[0]).toEqual({ kind: "counterfactual", text: "cf" });
    expect(out.state.currentTurnId).toBe("t3");
  });

  it("completes on a terminal turn", () => {
    let s = must(decide(def, initialSimState(def, now), { turnId: "t1", optionId: "a", rationale: "", confidence: null, at: now })).state;
    const out = must(decide(def, s, { turnId: "t2", optionId: "d", rationale: "", confidence: null, at: now }));
    s = out.state;
    expect(out.ended).toBe(true);
    expect(s.status).toBe("completed");
    expect(s.currentTurnId).toBeNull();
    expect(requestSimHint(s, 1).ok).toBe(false);
  });
});
