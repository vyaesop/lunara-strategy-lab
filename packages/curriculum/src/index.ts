import { ExerciseDefinition, type ExercisePublic } from "@lunara/schemas";

export * from "./investigations";
export * from "./simulations";
export * from "./puzzles";
export * from "./negotiations";
export * from "./missions";
export * from "./challenges";
import { bridgeContract } from "./exercises/bridge-contract";
import { lockedArchive } from "./exercises/locked-archive";
import { miracleCohort } from "./exercises/miracle-cohort";
import { positiveTest } from "./exercises/positive-test";
import { regionalLaunch } from "./exercises/regional-launch";
import { silentServer } from "./exercises/silent-server";

/**
 * Curated exercises. `public` parts are safe for any client; `hidden` parts
 * must only be read on the server and released through the session machine.
 */
export const EXERCISES: readonly ExerciseDefinition[] = [
  lockedArchive,
  miracleCohort,
  regionalLaunch,
  silentServer,
  positiveTest,
  bridgeContract,
];

export function listPublishedExercises(): ExercisePublic[] {
  return EXERCISES.filter((e) => e.public.status === "published").map((e) => e.public);
}

export function findExercise(id: string): ExerciseDefinition | null {
  return EXERCISES.find((e) => e.public.id === id) ?? null;
}

/** Validate every definition against the schema; used by tests and the server at boot. */
export function validateCurriculum(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const e of EXERCISES) {
    const r = ExerciseDefinition.safeParse(e);
    if (!r.success) {
      errors.push(`${e.public?.id ?? "?"}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    if (e.hidden.exerciseId !== e.public.id) errors.push(`${e.public.id}: hidden.exerciseId mismatch`);
    if (e.hidden.version !== e.public.version) errors.push(`${e.public.id}: hidden.version mismatch`);
    if (ids.has(e.public.id)) errors.push(`duplicate id ${e.public.id}`);
    if (slugs.has(e.public.slug)) errors.push(`duplicate slug ${e.public.slug}`);
    ids.add(e.public.id);
    slugs.add(e.public.slug);
    const rubricSkills = new Set(e.hidden.rubric.map((c) => c.skill));
    for (const d of e.public.expectedDimensions) {
      if (!rubricSkills.has(d)) errors.push(`${e.public.id}: expectedDimension ${d} has no rubric criterion`);
    }
    const criterionIds = e.hidden.rubric.map((c) => c.id);
    if (new Set(criterionIds).size !== criterionIds.length) errors.push(`${e.public.id}: duplicate rubric criterion ids`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
