import { describe, expect, it } from "vitest";
import {
  CoachingSession,
  ExercisePublic,
  IsoTimestamp,
  UserPreferences,
  UserPreferencesPatch,
  newUserProfile,
} from "./index";

const now = "2026-09-25T12:00:00.000Z";

describe("common", () => {
  it("accepts ISO timestamps with offset and rejects bare dates", () => {
    expect(IsoTimestamp.safeParse(now).success).toBe(true);
    expect(IsoTimestamp.safeParse("2026-09-25").success).toBe(false);
  });
});

describe("UserProfile", () => {
  it("builds a valid new profile with defaults", () => {
    const p = newUserProfile({ uid: "abc", email: "a@b.co", displayName: null, now });
    expect(p.onboarding.completed).toBe(false);
    expect(p.preferences.coachingIntensity).toBe("balanced");
    expect(p.stats.streak.current).toBe(0);
  });

  it("applies preference defaults to partial input", () => {
    const prefs = UserPreferences.parse({ theme: "dark" });
    expect(prefs.theme).toBe("dark");
    expect(prefs.sessionLength).toBe("standard");
    expect(prefs.focusModes).toEqual([]);
  });

  it("preference patches never introduce defaults for omitted keys", () => {
    const patch = UserPreferencesPatch.parse({ sessionLength: "short" });
    expect(patch).toEqual({ sessionLength: "short" });
    const merged = UserPreferences.parse({ ...UserPreferences.parse({ coachingIntensity: "demanding" }), ...patch });
    expect(merged.coachingIntensity).toBe("demanding");
    expect(merged.sessionLength).toBe("short");
  });
});

describe("ExercisePublic", () => {
  it("rejects slugs with uppercase or spaces", () => {
    const base = {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      id: "ex-1",
      slug: "Bad Slug",
      version: 1,
      status: "published",
      source: "curated",
      title: "T",
      summary: "S",
      mode: "deductive_reasoning",
      difficulty: 2,
      answerKind: "fixed",
      estimatedMinutes: 10,
      learningObjectives: ["Learn"],
      scenario: "Scenario",
      facts: [],
      constraints: [],
      expectedDimensions: ["logical_validity"],
      tags: [],
    };
    expect(ExercisePublic.safeParse(base).success).toBe(false);
    expect(ExercisePublic.safeParse({ ...base, slug: "good-slug" }).success).toBe(true);
  });
});

describe("CoachingSession", () => {
  it("bounds hint level to 0..5", () => {
    const s = {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      id: "s1",
      uid: "u1",
      exerciseId: "ex-1",
      exerciseVersion: 1,
      mode: "deductive_reasoning",
      status: "active",
      phase: "introduction",
      hintLevel: 6,
      revealed: false,
      hypotheses: [],
      decision: null,
      assessment: null,
      messageCount: 0,
      startedAt: now,
      lastActivityAt: now,
      completedAt: null,
    };
    expect(CoachingSession.safeParse(s).success).toBe(false);
    expect(CoachingSession.safeParse({ ...s, hintLevel: 5 }).success).toBe(true);
  });
});
