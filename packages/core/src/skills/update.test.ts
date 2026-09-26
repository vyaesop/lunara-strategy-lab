import { describe, expect, it } from "vitest";
import { applyEvidence, assistanceWeight, emptySkill, learningRate, recentTrend } from "./update";

const now = "2026-09-25T12:00:00.000Z";
const ev = (score: number, hintLevel = 0, revealedBeforeDecision = false) => ({
  sessionId: "s",
  exerciseId: "e",
  score,
  hintLevel,
  revealedBeforeDecision,
  at: now,
});

describe("learning rate and weights", () => {
  it("is fast early and bounded", () => {
    expect(learningRate(0)).toBe(0.5);
    expect(learningRate(1)).toBe(0.5);
    expect(learningRate(3)).toBeCloseTo(0.25);
    expect(learningRate(100)).toBe(0.1);
  });

  it("discounts assisted evidence but never below half weight", () => {
    expect(assistanceWeight(0)).toBe(1);
    expect(assistanceWeight(3)).toBeCloseTo(0.7);
    expect(assistanceWeight(5)).toBe(0.5);
    expect(assistanceWeight(99)).toBe(0.5);
  });
});

describe("applyEvidence", () => {
  it("starts at 0.5 with zero confidence and moves toward the score", () => {
    const s = applyEvidence(null, "logical_validity", ev(1));
    expect(s.estimate).toBeCloseTo(0.75);
    expect(s.evidenceCount).toBe(1);
    expect(s.confidence).toBeCloseTo(1 / 8);
    expect(s.unaidedEstimate).toBe(1);
  });

  it("does not move the unaided estimate on assisted evidence", () => {
    const s0 = applyEvidence(null, "planning", ev(0.9));
    const s1 = applyEvidence(s0, "planning", ev(0.2, 3));
    expect(s1.unaidedEstimate).toBe(0.9);
    expect(s1.estimate).toBeLessThan(s0.estimate);
  });

  it("treats revealed-before-decision as assisted", () => {
    const s = applyEvidence(null, "planning", ev(1, 0, true));
    expect(s.unaidedEstimate).toBeNull();
  });

  it("caps recent evidence at 10 and confidence at 1", () => {
    let s = emptySkill("planning", now);
    for (let i = 0; i < 15; i++) s = applyEvidence(s, "planning", ev(0.6));
    expect(s.recentEvidence).toHaveLength(10);
    expect(s.confidence).toBe(1);
    expect(s.evidenceCount).toBe(15);
  });

  it("keeps estimates within 0..1", () => {
    let s = emptySkill("planning", now);
    for (let i = 0; i < 30; i++) s = applyEvidence(s, "planning", ev(1));
    expect(s.estimate).toBeLessThanOrEqual(1);
    for (let i = 0; i < 60; i++) s = applyEvidence(s, "planning", ev(0));
    expect(s.estimate).toBeGreaterThanOrEqual(0);
  });
});

describe("recentTrend", () => {
  it("needs at least four points", () => {
    let s = emptySkill("planning", now);
    s = applyEvidence(s, "planning", ev(0.2));
    expect(recentTrend(s)).toBeNull();
  });
  it("is positive when scores improve", () => {
    let s = emptySkill("planning", now);
    for (const v of [0.2, 0.3, 0.7, 0.8]) s = applyEvidence(s, "planning", ev(v));
    expect(recentTrend(s)).toBeGreaterThan(0);
  });
});
