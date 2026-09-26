import { eq } from "drizzle-orm";
import {
  LearningGoal,
  OnboardingAnswers,
  SkillAssessment,
  USER_PROFILE_SCHEMA_VERSION,
  UserPreferences,
  UserProfile,
  UserStats,
  newUserProfile,
  nowIso,
} from "@lunara/schemas";
import type { Db } from "../db/client";
import { profiles, skillAssessments, user as userTable } from "../db/schema";
import { invalid } from "../errors";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToProfile(row: typeof profiles.$inferSelect, u: { email: string; name: string }): UserProfile {
  const prefs = UserPreferences.safeParse(row.preferences ?? {});
  const goals = LearningGoal.array().safeParse(row.goals ?? []);
  const stats = UserStats.safeParse(row.stats ?? {});
  const answers = row.onboardingAnswers ? OnboardingAnswers.safeParse(row.onboardingAnswers) : null;
  return UserProfile.parse({
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    uid: row.userId,
    email: u.email || null,
    displayName: u.name || null,
    onboarding: {
      completed: row.onboardingCompleted,
      completedAt: iso(row.onboardingCompletedAt),
      answers: answers?.success ? answers.data : null,
    },
    preferences: prefs.success ? prefs.data : UserPreferences.parse({}),
    goals: goals.success ? goals.data : [],
    stats: stats.success ? stats.data : UserStats.parse({}),
    roles: { admin: row.isAdmin },
  });
}

/** Load the profile, creating it on first contact. `adminEmails` bootstraps the admin flag server-side. */
export async function ensureProfile(db: Db, u: { id: string; email: string; name: string }, adminEmails: readonly string[] = []): Promise<UserProfile> {
  const shouldBeAdmin = adminEmails.includes(u.email.toLowerCase());
  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, u.id) });
  if (existing) {
    if (shouldBeAdmin && !existing.isAdmin) {
      const [row] = await db.update(profiles).set({ isAdmin: true, updatedAt: new Date() }).where(eq(profiles.userId, u.id)).returning();
      return rowToProfile(row!, u);
    }
    return rowToProfile(existing, u);
  }
  const fresh = newUserProfile({ uid: u.id, email: u.email || null, displayName: u.name || null, now: nowIso() });
  const [row] = await db
    .insert(profiles)
    .values({
      userId: u.id,
      schemaVersion: USER_PROFILE_SCHEMA_VERSION,
      preferences: fresh.preferences,
      goals: [],
      stats: fresh.stats,
      isAdmin: shouldBeAdmin,
    })
    .onConflictDoNothing()
    .returning();
  if (row) return rowToProfile(row, u);
  const again = await db.query.profiles.findFirst({ where: eq(profiles.userId, u.id) });
  if (!again) throw new Error("profile creation failed");
  return rowToProfile(again, u);
}

export async function updatePreferences(db: Db, u: { id: string; email: string; name: string }, patch: Partial<UserPreferences>) {
  const current = await ensureProfile(db, u);
  const merged = UserPreferences.parse({ ...current.preferences, ...patch });
  const [row] = await db
    .update(profiles)
    .set({ preferences: merged, updatedAt: new Date() })
    .where(eq(profiles.userId, u.id))
    .returning();
  return rowToProfile(row!, u);
}

export async function completeOnboarding(
  db: Db,
  u: { id: string; email: string; name: string },
  answers: OnboardingAnswers,
  prefs?: Partial<UserPreferences>,
) {
  const current = await ensureProfile(db, u);
  const merged = UserPreferences.parse({ ...current.preferences, ...(prefs ?? {}) });
  const [row] = await db
    .update(profiles)
    .set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      onboardingAnswers: answers,
      preferences: merged,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, u.id))
    .returning();
  return rowToProfile(row!, u);
}

export async function upsertGoal(
  db: Db,
  u: { id: string; email: string; name: string },
  input: { id?: string | undefined; title: string; description?: string | undefined; targetModes?: LearningGoal["targetModes"] },
  makeId: () => string,
) {
  const current = await ensureProfile(db, u);
  const goals = [...current.goals];
  const idx = input.id ? goals.findIndex((g) => g.id === input.id) : -1;
  const goal = LearningGoal.parse({
    id: input.id ?? makeId(),
    title: input.title,
    description: input.description,
    targetModes: input.targetModes ?? [],
    createdAt: idx >= 0 ? goals[idx]!.createdAt : nowIso(),
  });
  if (idx >= 0) goals[idx] = goal;
  else {
    if (goals.length >= 10) throw invalid("At most 10 goals");
    goals.push(goal);
  }
  const [row] = await db.update(profiles).set({ goals, updatedAt: new Date() }).where(eq(profiles.userId, u.id)).returning();
  return rowToProfile(row!, u);
}

export async function deleteGoal(db: Db, u: { id: string; email: string; name: string }, goalId: string) {
  const current = await ensureProfile(db, u);
  const goals = current.goals.filter((g) => g.id !== goalId);
  const [row] = await db.update(profiles).set({ goals, updatedAt: new Date() }).where(eq(profiles.userId, u.id)).returning();
  return rowToProfile(row!, u);
}

export async function updateStats(db: Db, userId: string, stats: UserStats) {
  await db.update(profiles).set({ stats, updatedAt: new Date() }).where(eq(profiles.userId, userId));
}

export async function listSkills(db: Db, userId: string): Promise<SkillAssessment[]> {
  const rows = await db.select().from(skillAssessments).where(eq(skillAssessments.userId, userId));
  return rows.map((r) =>
    SkillAssessment.parse({
      schemaVersion: r.schemaVersion,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      skillId: r.skillId,
      estimate: r.estimate,
      unaidedEstimate: r.unaidedEstimate,
      confidence: r.confidence,
      evidenceCount: r.evidenceCount,
      lastEvidenceAt: iso(r.lastEvidenceAt),
      recentEvidence: r.recentEvidence,
    }),
  );
}

/** Delete the account: cascades to profile, sessions, messages, skills. */
export async function deleteAccount(db: Db, userId: string) {
  await db.delete(userTable).where(eq(userTable.id, userId));
}
