import { SimulationDefinition, type SimulationPublic } from "@lunara/schemas";
import { validateSimulation } from "@lunara/core";
import { bismarck1866 } from "./bismarck-1866";
import { carnegie1873 } from "./carnegie-1873";

export const SIMULATIONS: readonly SimulationDefinition[] = [bismarck1866, carnegie1873];

export function listPublishedSimulations(): SimulationPublic[] {
  return SIMULATIONS.filter((s) => s.public.status === "published").map((s) => s.public);
}

export function findSimulation(id: string): SimulationDefinition | null {
  return SIMULATIONS.find((s) => s.public.id === id) ?? null;
}

export function validateSimulations(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const s of SIMULATIONS) {
    const r = SimulationDefinition.safeParse(s);
    if (!r.success) {
      errors.push(`${s.public.id}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    if (s.hidden.simulationId !== s.public.id) errors.push(`${s.public.id}: hidden id mismatch`);
    for (const e of validateSimulation(s)) errors.push(`${s.public.id}: ${e}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
