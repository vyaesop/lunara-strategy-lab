import type { CoachingSession, ExercisePublic, SkillAssessment, SkillId, TrainingMode, UserPreferences } from "@lunara/schemas";
import { SKILL_DEFINITIONS } from "../skills/definitions";

/**
 * Explainable exercise recommendation. Every result carries the rule that
 * produced it and a reason grounded in persisted evidence. Rules, in order:
 *
 *  1. weakest_skill      – an unattempted exercise that trains the user's
 *                          lowest-estimate skill with ≥ 2 observations
 *  2. unattempted_focus  – unattempted exercise in a user-chosen focus mode
 *  3. unfamiliar_mode    – controlled exposure: a mode never attempted, once
 *                          the user has ≥ 3 completed sessions
 *  4. step_up            – recent completed sessions average ≥ 0.75 → next
 *                          difficulty up in a mode already practised
 *  5. unattempted        – any unattempted exercise, lowest difficulty first
 *  6. practice_unaided   – everything attempted: repeat the exercise with the
 *                          highest hint use, to practise without assistance
 */
export interface RecommendationInput {
  exercises: ExercisePublic[];
  sessions: CoachingSession[];
  skills: SkillAssessment[];
  preferences: UserPreferences;
}

export interface RecommendationResult {
  exercise: ExercisePublic;
  reason: string;
  rule: "repeated_error" | "unattempted_focus" | "weakest_skill" | "unfamiliar_mode" | "step_up" | "unattempted" | "practice_unaided";
}

/** Error patterns recorded by assessments, counted across completed sessions. */
export function repeatedErrorPatterns(sessions: CoachingSession[], min = 2): Array<{ pattern: string; count: number; modes: TrainingMode[] }> {
  const acc = new Map<string, { count: number; modes: Set<TrainingMode> }>();
  for (const s of sessions) {
    for (const p of s.assessment?.errorPatterns ?? []) {
      const e = acc.get(p) ?? { count: 0, modes: new Set<TrainingMode>() };
      e.count += 1;
      e.modes.add(s.mode);
      acc.set(p, e);
    }
  }
  return [...acc.entries()]
    .filter(([, v]) => v.count >= min)
    .map(([pattern, v]) => ({ pattern, count: v.count, modes: [...v.modes] }))
    .sort((a, b) => b.count - a.count);
}

const MIN_EVIDENCE_FOR_WEAKEST = 2;
const SESSIONS_BEFORE_EXPOSURE = 3;
const STEP_UP_THRESHOLD = 0.75;

export function recommend(input: RecommendationInput, limit = 4): RecommendationResult[] {
  const published = input.exercises.filter((e) => e.status === "published");
  // Ties on difficulty keep the curriculum's own order.
  const order = new Map(published.map((e, i) => [e.id, i]));
  const byDifficulty = (a: ExercisePublic, b: ExercisePublic) => a.difficulty - b.difficulty || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  const attempted = new Set(input.sessions.map((s) => s.exerciseId));
  const completed = input.sessions.filter((s) => s.status === "completed");
  const unattempted = published.filter((e) => !attempted.has(e.id)).sort(byDifficulty);
  const modesDone = new Set<TrainingMode>(completed.map((s) => s.mode));
  const results: RecommendationResult[] = [];
  const taken = new Set<string>();
  const push = (r: RecommendationResult) => {
    if (taken.has(r.exercise.id) || results.length >= limit) return;
    taken.add(r.exercise.id);
    results.push(r);
  };

  // 0. repeated error pattern → practise in the mode where it recurred
  const repeated = repeatedErrorPatterns(completed)[0];
  if (repeated) {
    const target = unattempted.find((e) => repeated.modes.includes(e.mode)) ?? unattempted.find((e) => e.mode === repeated.modes[0]);
    if (target) {
      push({
        exercise: target,
        rule: "repeated_error",
        reason: `Recommended because your last assessments flagged "${repeated.pattern.replace(/_/g, " ")}" ${repeated.count} times in ${repeated.modes.map(label).join(" and ")}; this exercise gives you another attempt at that kind of reasoning.`,
      });
    }
  }

  // 1. weakest skill with enough evidence
  const evidenced = input.skills.filter((s) => s.evidenceCount >= MIN_EVIDENCE_FOR_WEAKEST).sort((a, b) => a.estimate - b.estimate);
  const weakest = evidenced[0];
  if (weakest) {
    const target = unattempted.find((e) => e.expectedDimensions.includes(weakest.skillId));
    if (target) {
      push({
        exercise: target,
        rule: "weakest_skill",
        reason: `Recommended because ${SKILL_DEFINITIONS[weakest.skillId].label.toLowerCase()} is currently your lowest estimate (${Math.round(weakest.estimate * 100)} from ${weakest.evidenceCount} observations) and this exercise produces evidence for it.`,
      });
    }
  }

  // 2. focus modes
  for (const mode of input.preferences.focusModes) {
    const target = unattempted.find((e) => e.mode === mode);
    if (target) {
      push({
        exercise: target,
        rule: "unattempted_focus",
        reason: `Recommended because you chose ${label(mode)} as a focus and you have not attempted this exercise yet.`,
      });
    }
  }

  // 3. controlled exposure to unfamiliar modes
  if (completed.length >= SESSIONS_BEFORE_EXPOSURE) {
    const target = unattempted.find((e) => !modesDone.has(e.mode));
    if (target) {
      push({
        exercise: target,
        rule: "unfamiliar_mode",
        reason: `Recommended because you have completed ${completed.length} sessions but none in ${label(target.mode)}; the curriculum deliberately includes unfamiliar areas.`,
      });
    }
  }

  // 4. step up in difficulty
  const recent = completed.filter((s) => s.assessment).slice(0, 5);
  if (recent.length >= 2) {
    const avg = recent.reduce((a, s) => a + (s.assessment?.overallScore ?? 0), 0) / recent.length;
    if (avg >= STEP_UP_THRESHOLD) {
      const maxDone = Math.max(...completed.map((s) => published.find((e) => e.id === s.exerciseId)?.difficulty ?? 1));
      const target = unattempted.find((e) => e.difficulty > maxDone && modesDone.has(e.mode));
      if (target) {
        push({
          exercise: target,
          rule: "step_up",
          reason: `Recommended because your last ${recent.length} assessed sessions averaged ${Math.round(avg * 100)}, so a harder ${label(target.mode)} exercise is due.`,
        });
      }
    }
  }

  // 5. anything unattempted
  for (const e of unattempted) {
    push({ exercise: e, rule: "unattempted", reason: `Recommended because you have not attempted it yet; it is a difficulty ${e.difficulty} ${label(e.mode)} exercise.` });
  }

  // 6. practise unaided
  if (results.length < limit && published.length > 0) {
    const mostAssisted = [...input.sessions]
      .filter((s) => s.status === "completed")
      .sort((a, b) => b.hintLevel - a.hintLevel)[0];
    const target = mostAssisted ? published.find((e) => e.id === mostAssisted.exerciseId) : published[0];
    if (target) {
      push({
        exercise: target,
        rule: "practice_unaided",
        reason: mostAssisted && mostAssisted.hintLevel > 0
          ? `Recommended because you used ${mostAssisted.hintLevel} hint${mostAssisted.hintLevel === 1 ? "" : "s"} last time; a fresh attempt without hints builds unaided mastery.`
          : "Recommended for a fresh unaided attempt; you have attempted every available exercise.",
      });
    }
  }

  return results;
}

export function weakestSkill(skills: SkillAssessment[]): SkillId | null {
  const s = skills.filter((x) => x.evidenceCount >= MIN_EVIDENCE_FOR_WEAKEST).sort((a, b) => a.estimate - b.estimate)[0];
  return s?.skillId ?? null;
}

function label(mode: TrainingMode): string {
  return mode.replace(/_/g, " ");
}
