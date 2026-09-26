import { describe, expect, it } from "vitest";
import type { NegotiationDefinition } from "@lunara/schemas";
import { acceptanceThreshold, counterpartUtility, respondToProposal, userValue, validateProposal } from "./engine";

const now = "2026-09-26T10:00:00.000Z";
const def: NegotiationDefinition = {
  public: {
    schemaVersion: 1, createdAt: now, updatedAt: now, id: "neg-t", slug: "neg-t", version: 1, status: "published", title: "T", summary: "s", difficulty: 2, estimatedMinutes: 20,
    learningObjectives: ["o"], briefing: "b", userRole: "vendor", counterpart: { name: "Buyer", role: "procurement", publicDescription: "d" },
    issues: [
      { key: "price", label: "Price", unit: "k", min: 90, max: 130, step: 1, userPrefersHigh: true },
      { key: "term", label: "Term", unit: "y", min: 1, max: 3, step: 1, userPrefersHigh: true },
      { key: "extras", label: "Extras", unit: "", min: 0, max: 1, step: 1, userPrefersHigh: false },
    ],
    userGuidance: "g", maxRounds: 6, expectedDimensions: ["negotiation"], tags: [],
  },
  hidden: {
    negotiationId: "neg-t", version: 1, persona: "p",
    weights: { price: 0.6, term: 0.2, extras: 0.2 },
    counterpartPrefersHigh: { price: false, term: true, extras: true },
    acceptThreshold: 0.6, patienceDecay: 0.03, floor: 0.45,
    opening: { price: 95, term: 1, extras: 1 },
    referenceDeal: { price: 112, term: 3, extras: 1 },
    rubric: [{ id: "r", title: "t", description: "d", weight: 1, skill: "negotiation", levels: [{ score: 0, descriptor: "a" }, { score: 1, descriptor: "b" }] }],
    debrief: "d",
  },
};

describe("negotiation engine", () => {
  it("computes utilities in each party's direction", () => {
    expect(counterpartUtility(def, { price: 90, term: 3, extras: 1 })).toBeCloseTo(1);
    expect(counterpartUtility(def, { price: 130, term: 1, extras: 0 })).toBeCloseTo(0);
    expect(userValue(def, def.hidden.referenceDeal)).toBeCloseTo(1);
  });

  it("threshold decays with rounds but not below the floor", () => {
    expect(acceptanceThreshold(def, 1)).toBeCloseTo(0.6);
    expect(acceptanceThreshold(def, 3)).toBeCloseTo(0.54);
    expect(acceptanceThreshold(def, 50)).toBeCloseTo(0.45);
  });

  it("validates and snaps proposals", () => {
    expect(validateProposal(def, { price: 100, term: 2 }).ok).toBe(false);
    expect(validateProposal(def, { price: 200, term: 2, extras: 1 }).ok).toBe(false);
    const ok = validateProposal(def, { price: 100.4, term: 2, extras: 1 });
    expect(ok.ok && ok.terms.price).toBe(100);
  });

  it("accepts generous proposals, counters greedy ones, and the counter is acceptable to itself", () => {
    const accept = respondToProposal(def, { price: 95, term: 3, extras: 1 }, 1, null);
    expect(accept.kind).toBe("accept");
    const counter = respondToProposal(def, { price: 130, term: 3, extras: 0 }, 1, null);
    expect(counter.kind).toBe("counter");
    if (counter.kind === "counter") {
      expect(counterpartUtility(def, counter.counter)).toBeGreaterThanOrEqual(acceptanceThreshold(def, 1));
      expect(counter.counter.price).toBeGreaterThanOrEqual(95);
    }
  });

  it("concedes gradually across rounds toward the user's ask", () => {
    let last: Record<string, number> | null = null;
    const prices: number[] = [];
    for (let round = 1; round <= 5; round++) {
      const r = respondToProposal(def, { price: 125, term: 3, extras: 0 }, round, last);
      if (r.kind !== "counter") break;
      prices.push(r.counter.price!);
      last = r.counter;
    }
    expect(prices.length).toBeGreaterThan(1);
    for (let i = 1; i < prices.length; i++) expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
  });
});
