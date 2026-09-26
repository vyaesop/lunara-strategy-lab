import { describe, expect, it } from "vitest";
import type { QuickPuzzle } from "@lunara/schemas";
import { pickForDay, puzzleForDay, questionForDay } from "./briefing";

const bank: QuickPuzzle[] = Array.from({ length: 5 }, (_, i) => ({ id: `qp-${i}`, kind: "deduction", prompt: `p${i}`, answer: `a${i}`, explanation: "e" }));

describe("daily briefing selection", () => {
  it("is deterministic per user and day", () => {
    expect(puzzleForDay(bank, "u1", "2026-09-26")).toEqual(puzzleForDay(bank, "u1", "2026-09-26"));
    expect(questionForDay("u1", "2026-09-26")).toBe(questionForDay("u1", "2026-09-26"));
  });
  it("varies across days and users", () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const picks = new Set(days.map((d) => puzzleForDay(bank, "u1", d)!.id));
    expect(picks.size).toBeGreaterThan(1);
    expect(pickForDay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "a", "2026-09-26")).not.toBe(pickForDay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "bbbb", "2026-09-26"));
  });
  it("handles an empty bank", () => {
    expect(puzzleForDay([], "u", "2026-09-26")).toBeNull();
  });
});
