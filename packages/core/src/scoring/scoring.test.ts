import { describe, expect, it } from "vitest";
import type { RubricCriterion } from "@lunara/schemas";
import { brierScore, calibrationBuckets, hasEnoughCalibrationData } from "./calibration";
import { aggregateRubric, classifyOutcome, skillScoresFromRubric, unaidedScore } from "./rubric";

const criteria: RubricCriterion[] = [
  {
    id: "c1",
    title: "Multiple hypotheses",
    description: "Generated at least two distinct explanations.",
    weight: 2,
    skill: "hypothesis_generation",
    levels: [
      { score: 0, descriptor: "One or none" },
      { score: 1, descriptor: "Two or more distinct" },
    ],
  },
  {
    id: "c2",
    title: "Evidence links",
    description: "Linked evidence to hypotheses.",
    weight: 1,
    skill: "evidence_evaluation",
    levels: [
      { score: 0, descriptor: "None" },
      { score: 1, descriptor: "Explicit links" },
    ],
  },
  {
    id: "c3",
    title: "Distinctness",
    description: "Hypotheses are not restatements.",
    weight: 1,
    skill: "hypothesis_generation",
    levels: [
      { score: 0, descriptor: "Restatements" },
      { score: 1, descriptor: "Genuinely different" },
    ],
  },
];

describe("aggregateRubric", () => {
  it("computes the weighted mean", () => {
    const score = aggregateRubric(criteria, [
      { criterionId: "c1", score: 1, evidence: "x" },
      { criterionId: "c2", score: 0, evidence: "x" },
      { criterionId: "c3", score: 0.5, evidence: "x" },
    ]);
    expect(score).toBeCloseTo((2 * 1 + 0 + 0.5) / 4);
  });

  it("rejects missing, duplicate and unknown criteria", () => {
    expect(() => aggregateRubric(criteria, [{ criterionId: "c1", score: 1, evidence: "x" }])).toThrow(/Missing/);
    expect(() =>
      aggregateRubric(criteria, [
        { criterionId: "c1", score: 1, evidence: "x" },
        { criterionId: "c1", score: 1, evidence: "x" },
        { criterionId: "c2", score: 1, evidence: "x" },
      ]),
    ).toThrow(/Duplicate/);
    expect(() =>
      aggregateRubric(criteria, [
        { criterionId: "c1", score: 1, evidence: "x" },
        { criterionId: "c2", score: 1, evidence: "x" },
        { criterionId: "c3", score: 1, evidence: "x" },
        { criterionId: "zz", score: 1, evidence: "x" },
      ]),
    ).toThrow(/Unknown/);
  });
});

describe("skillScoresFromRubric", () => {
  it("groups by skill with weights", () => {
    const scores = skillScoresFromRubric(criteria, [
      { criterionId: "c1", score: 1, evidence: "x" },
      { criterionId: "c2", score: 0.4, evidence: "x" },
      { criterionId: "c3", score: 0, evidence: "x" },
    ]);
    const hg = scores.find((s) => s.skillId === "hypothesis_generation")!;
    const ee = scores.find((s) => s.skillId === "evidence_evaluation")!;
    expect(hg.score).toBeCloseTo(2 / 3);
    expect(ee.score).toBeCloseTo(0.4);
  });
});

describe("unaidedScore and outcome classification", () => {
  it("discounts hints and caps early reveals", () => {
    expect(unaidedScore(1, 0, false)).toBe(1);
    expect(unaidedScore(1, 2, false)).toBeCloseTo(0.76);
    expect(unaidedScore(1, 0, true)).toBe(0.3);
    expect(unaidedScore(0.2, 0, true)).toBeCloseTo(0.2);
  });

  it("separates luck from judgement", () => {
    expect(classifyOutcome(true, 0.9)).toBe("correct_well_supported");
    expect(classifyOutcome(true, 0.2)).toBe("correct_by_coincidence");
    expect(classifyOutcome(false, 0.8)).toBe("incorrect_reasonably_justified");
    expect(classifyOutcome(false, 0.1)).toBe("incorrect_poorly_supported");
    expect(classifyOutcome(null, 0.9)).toBe("not_applicable");
  });
});

describe("calibration", () => {
  it("brier score is 0 for perfect and 0.25 for p=0.5", () => {
    expect(brierScore([])).toBeNull();
    expect(brierScore([{ probability: 1, outcome: true }, { probability: 0, outcome: false }])).toBe(0);
    expect(brierScore([{ probability: 0.5, outcome: true }])).toBe(0.25);
  });

  it("requires ten forecasts before display", () => {
    const nine = Array.from({ length: 9 }, () => ({ probability: 0.5, outcome: true }));
    expect(hasEnoughCalibrationData(nine)).toBe(false);
    expect(hasEnoughCalibrationData([...nine, { probability: 0.5, outcome: false }])).toBe(true);
  });

  it("buckets include the upper edge in the last bucket", () => {
    const b = calibrationBuckets([{ probability: 1, outcome: true }, { probability: 0, outcome: false }], 5);
    expect(b[0]!.count).toBe(1);
    expect(b[4]!.count).toBe(1);
    expect(b[4]!.observedFrequency).toBe(1);
  });
});
