import { z } from "zod";
import { DocumentId, IsoTimestamp, PersistedMeta, ShortText } from "./common";
import { TrainingMode } from "./exercise";

export const CoachingIntensity = z.enum(["gentle", "balanced", "demanding"]);
export type CoachingIntensity = z.infer<typeof CoachingIntensity>;

export const SessionLengthPreference = z.enum(["short", "standard", "deep"]);
export type SessionLengthPreference = z.infer<typeof SessionLengthPreference>;

export const ThemePreference = z.enum(["system", "light", "dark"]);

const NotificationPreferences = z.object({
  dailyBriefing: z.boolean(),
  reviewReminders: z.boolean(),
});

export const UserPreferences = z.object({
  coachingIntensity: CoachingIntensity.default("balanced"),
  sessionLength: SessionLengthPreference.default("standard"),
  theme: ThemePreference.default("system"),
  notifications: NotificationPreferences.default({ dailyBriefing: false, reviewReminders: false }),
  /** Modes the user asked to emphasise. Empty = balanced curriculum. */
  focusModes: z.array(TrainingMode).max(6).default([]),
});
export type UserPreferences = z.infer<typeof UserPreferences>;

/**
 * Partial update without defaults. `UserPreferences.partial()` would fill
 * omitted keys with defaults and silently reset the user's other settings.
 */
export const UserPreferencesPatch = z.object({
  coachingIntensity: CoachingIntensity.optional(),
  sessionLength: SessionLengthPreference.optional(),
  theme: ThemePreference.optional(),
  notifications: NotificationPreferences.optional(),
  focusModes: z.array(TrainingMode).max(6).optional(),
});
export type UserPreferencesPatch = z.infer<typeof UserPreferencesPatch>;

export const LearningGoal = z.object({
  id: DocumentId,
  title: ShortText,
  description: z.string().max(1_000).optional(),
  targetModes: z.array(TrainingMode).max(6).default([]),
  createdAt: IsoTimestamp,
});
export type LearningGoal = z.infer<typeof LearningGoal>;

/**
 * Onboarding answers are preferences and a self-reported starting point.
 * They never set an authoritative skill level.
 */
export const OnboardingAnswers = z.object({
  primaryGoals: z.array(ShortText).max(5).default([]),
  interests: z.array(ShortText).max(10).default([]),
  selfReportedExperience: z.enum(["new", "some", "experienced"]).optional(),
  startWith: z.enum(["strategy", "deduction", "negotiation", "general"]).optional(),
});
export type OnboardingAnswers = z.infer<typeof OnboardingAnswers>;

export const UserStats = z.object({
  sessionsStarted: z.number().int().min(0).default(0),
  sessionsCompleted: z.number().int().min(0).default(0),
  streak: z
    .object({
      current: z.number().int().min(0).default(0),
      longest: z.number().int().min(0).default(0),
      /** YYYY-MM-DD of the last day with a completed session. */
      lastActiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    })
    .default({ current: 0, longest: 0, lastActiveDate: null }),
});
export type UserStats = z.infer<typeof UserStats>;

export const USER_PROFILE_SCHEMA_VERSION = 1;

export const UserProfile = PersistedMeta.extend({
  uid: z.string().min(1).max(128),
  email: z.email().nullable(),
  displayName: z.string().max(120).nullable(),
  onboarding: z.object({
    completed: z.boolean(),
    completedAt: IsoTimestamp.nullable(),
    answers: OnboardingAnswers.nullable(),
  }),
  preferences: UserPreferences,
  goals: z.array(LearningGoal).max(10),
  stats: UserStats,
  /** Mirror of custom claims for display only; authorization uses claims. */
  roles: z.object({ admin: z.boolean().default(false) }).default({ admin: false }),
});
export type UserProfile = z.infer<typeof UserProfile>;

export function newUserProfile(input: {
  uid: string;
  email: string | null;
  displayName: string | null;
  now: IsoTimestamp;
}): UserProfile {
  return UserProfile.parse({
    schemaVersion: USER_PROFILE_SCHEMA_VERSION,
    createdAt: input.now,
    updatedAt: input.now,
    uid: input.uid,
    email: input.email,
    displayName: input.displayName,
    onboarding: { completed: false, completedAt: null, answers: null },
    preferences: UserPreferences.parse({}),
    goals: [],
    stats: UserStats.parse({}),
    roles: { admin: false },
  });
}
