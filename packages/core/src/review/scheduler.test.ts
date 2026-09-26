import { describe, expect, it } from "vitest";
import { gradeCard, isDue, newReviewCard, previewIntervals, retentionScore } from "./scheduler";

const t0 = new Date("2026-09-26T09:00:00.000Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

describe("FSRS scheduler wrapper", () => {
  it("new cards are due immediately", () => {
    const c = newReviewCard(t0);
    expect(isDue(c, t0)).toBe(true);
    expect(c.reps).toBe(0);
    expect(c.state).toBe(0);
  });

  it("intervals grow with successive good ratings and shrink on again", () => {
    let c = newReviewCard(t0);
    let now = t0;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = gradeCard(c, "good", now);
      intervals.push(r.intervalDays);
      c = r.card;
      now = new Date(c.due);
    }
    expect(intervals[3]!).toBeGreaterThan(intervals[1]!);
    expect(c.reps).toBe(4);
    const lapse = gradeCard(c, "again", now);
    expect(lapse.card.lapses).toBe(1);
    expect(lapse.intervalDays).toBeLessThan(intervals[3]!);
  });

  it("preview orders intervals again ≤ hard ≤ good ≤ easy", () => {
    let c = newReviewCard(t0);
    c = gradeCard(c, "good", t0).card;
    c = gradeCard(c, "good", days(3)).card;
    const p = previewIntervals(c, days(10));
    expect(p.again).toBeLessThanOrEqual(p.hard);
    expect(p.hard).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThanOrEqual(p.easy);
  });

  it("round-trips through the persisted shape", () => {
    const c = gradeCard(newReviewCard(t0), "easy", t0).card;
    expect(typeof c.due).toBe("string");
    expect(c.last_review).toBe(t0.toISOString());
    expect(isDue(c, t0)).toBe(false);
  });

  it("maps ratings to retention evidence", () => {
    expect(retentionScore("again")).toBe(0);
    expect(retentionScore("easy")).toBe(1);
  });
});
