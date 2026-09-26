import { InvestigationDefinition, type InvestigationPublic } from "@lunara/schemas";
import { vanishedConsignment } from "./vanished-consignment";
import { warehouseFire } from "./warehouse-fire";

export const INVESTIGATIONS: readonly InvestigationDefinition[] = [warehouseFire, vanishedConsignment];

export function listPublishedInvestigations(): InvestigationPublic[] {
  return INVESTIGATIONS.filter((i) => i.public.status === "published").map((i) => i.public);
}

export function findInvestigation(id: string): InvestigationDefinition | null {
  return INVESTIGATIONS.find((i) => i.public.id === id) ?? null;
}

/**
 * Consistency checks: every action reveals known evidence, prerequisites and
 * key evidence exist, the answer is a candidate entity, every piece of
 * non-initial evidence is reachable, and the budget can reach all key
 * evidence along some path.
 */
export function validateInvestigations(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const inv of INVESTIGATIONS) {
    const r = InvestigationDefinition.safeParse(inv);
    const id = inv.public.id;
    if (!r.success) {
      errors.push(`${id}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    if (inv.hidden.investigationId !== id) errors.push(`${id}: hidden id mismatch`);
    const evidenceIds = new Set(inv.hidden.evidence.map((e) => e.id));
    const actionIds = new Set(inv.public.actions.map((a) => a.id));
    for (const [actionId, reveals] of Object.entries(inv.hidden.actionReveals)) {
      if (!actionIds.has(actionId)) errors.push(`${id}: actionReveals has unknown action ${actionId}`);
      for (const ev of reveals) if (!evidenceIds.has(ev)) errors.push(`${id}: action ${actionId} reveals unknown evidence ${ev}`);
    }
    for (const a of inv.public.actions) {
      if (!inv.hidden.actionReveals[a.id]?.length) errors.push(`${id}: action ${a.id} reveals nothing`);
      for (const req of a.requiresEvidence) if (!evidenceIds.has(req)) errors.push(`${id}: action ${a.id} requires unknown evidence ${req}`);
    }
    const reachable = new Set([...inv.hidden.evidence.filter((e) => e.initial).map((e) => e.id), ...Object.values(inv.hidden.actionReveals).flat()]);
    for (const e of inv.hidden.evidence) if (!reachable.has(e.id)) errors.push(`${id}: evidence ${e.id} is unreachable`);
    for (const k of inv.hidden.groundTruth.keyEvidenceIds) if (!evidenceIds.has(k)) errors.push(`${id}: key evidence ${k} unknown`);
    for (const m of inv.hidden.groundTruth.misleadingEvidenceIds) if (!evidenceIds.has(m)) errors.push(`${id}: misleading evidence ${m} unknown`);
    const answer = inv.hidden.groundTruth.answerEntityId;
    if (answer && !inv.public.entities.some((e) => e.id === answer && e.candidate)) errors.push(`${id}: answer entity ${answer} is not a candidate`);
    // Budget check: cheapest cost to reveal all key evidence (actions are independent except prerequisites).
    const cost = minimalCostForEvidence(inv, inv.hidden.groundTruth.keyEvidenceIds);
    if (cost === null) errors.push(`${id}: key evidence not reachable`);
    else if (cost > inv.public.budget) errors.push(`${id}: key evidence costs ${cost} but budget is ${inv.public.budget}`);
    const rubricSkills = new Set(inv.hidden.rubric.map((c) => c.skill));
    for (const d of inv.public.expectedDimensions) if (!rubricSkills.has(d)) errors.push(`${id}: expectedDimension ${d} has no rubric criterion`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

function minimalCostForEvidence(inv: InvestigationDefinition, targets: string[]): number | null {
  const initial = new Set(inv.hidden.evidence.filter((e) => e.initial).map((e) => e.id));
  const needed = new Set<string>();
  const queue = targets.filter((t) => !initial.has(t));
  const revealers = (ev: string) => inv.public.actions.filter((a) => (inv.hidden.actionReveals[a.id] ?? []).includes(ev));
  while (queue.length) {
    const ev = queue.pop()!;
    if (initial.has(ev)) continue;
    const options = revealers(ev).sort((a, b) => a.cost - b.cost);
    const action = options[0];
    if (!action) return null;
    if (needed.has(action.id)) continue;
    needed.add(action.id);
    for (const req of action.requiresEvidence) queue.push(req);
  }
  return [...needed].reduce((sum, id) => sum + (inv.public.actions.find((a) => a.id === id)?.cost ?? 0), 0);
}
