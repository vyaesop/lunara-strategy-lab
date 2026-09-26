import type { UserStats } from "@lunara/schemas";

/** YYYY-MM-DD in UTC. Streaks are computed on UTC days to stay deterministic. */
export function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  const ms = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const ms2 = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((ms2 - ms) / 86_400_000);
}

/** Record a completed session on `today` and update streak counters. */
export function recordCompletion(stats: UserStats, today: string): UserStats {
  const { lastActiveDate, current, longest } = stats.streak;
  let next = current;
  if (lastActiveDate === null) next = 1;
  else {
    const gap = dayDiff(lastActiveDate, today);
    if (gap <= 0) next = Math.max(current, 1);
    else if (gap === 1) next = current + 1;
    else next = 1;
  }
  return {
    ...stats,
    sessionsCompleted: stats.sessionsCompleted + 1,
    streak: { current: next, longest: Math.max(longest, next), lastActiveDate: today },
  };
}

/** A streak is alive if the last active day is today or yesterday. */
export function isStreakAlive(stats: UserStats, today: string): boolean {
  const last = stats.streak.lastActiveDate;
  if (!last) return false;
  const gap = dayDiff(last, today);
  return gap >= 0 && gap <= 1;
}
