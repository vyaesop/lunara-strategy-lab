import { describe, expect, it } from "vitest";
import type { UserStats } from "@lunara/schemas";
import { isStreakAlive, recordCompletion } from "./streak";

const base: UserStats = {
  sessionsStarted: 3,
  sessionsCompleted: 0,
  streak: { current: 0, longest: 0, lastActiveDate: null },
};

describe("streak", () => {
  it("starts at one", () => {
    const s = recordCompletion(base, "2026-09-25");
    expect(s.streak.current).toBe(1);
    expect(s.sessionsCompleted).toBe(1);
  });

  it("increments on consecutive days and does not double count a day", () => {
    let s = recordCompletion(base, "2026-09-25");
    s = recordCompletion(s, "2026-09-26");
    expect(s.streak.current).toBe(2);
    s = recordCompletion(s, "2026-09-26");
    expect(s.streak.current).toBe(2);
    expect(s.sessionsCompleted).toBe(3);
  });

  it("resets after a gap but keeps the longest", () => {
    let s = recordCompletion(base, "2026-09-25");
    s = recordCompletion(s, "2026-09-26");
    s = recordCompletion(s, "2026-09-30");
    expect(s.streak.current).toBe(1);
    expect(s.streak.longest).toBe(2);
  });

  it("handles month boundaries", () => {
    let s = recordCompletion(base, "2026-09-30");
    s = recordCompletion(s, "2026-10-01");
    expect(s.streak.current).toBe(2);
  });

  it("is alive today or yesterday only", () => {
    const s = recordCompletion(base, "2026-09-25");
    expect(isStreakAlive(s, "2026-09-25")).toBe(true);
    expect(isStreakAlive(s, "2026-09-26")).toBe(true);
    expect(isStreakAlive(s, "2026-09-27")).toBe(false);
    expect(isStreakAlive(base, "2026-09-27")).toBe(false);
  });
});
