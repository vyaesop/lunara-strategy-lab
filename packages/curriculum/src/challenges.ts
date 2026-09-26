import { ChallengeDefinition, type ChallengePublic } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/** Fictional, unfamiliar problem spanning investigation, planning, anticipation and decision. */
export const portConcession: ChallengeDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "chal-port-concession",
    slug: "port-concession",
    version: 1,
    status: "published",
    title: "The Port Concession",
    summary: "A small island state is deciding whether to grant a foreign consortium a 30-year concession to run its only deep-water port. You advise the finance minister. Nothing is quite what it seems.",
    difficulty: 4,
    estimatedMinutes: 120,
    timeBudgetMinutes: 120,
    briefing:
      "The island's port handles nearly all imports. The current operator, a state company, is loss-making and the cranes are old. A consortium has offered to invest 180 million, take a 30-year concession, and pay the state 12 percent of revenue. A regional rival port is expanding. The prime minister wants a decision in three weeks. You have limited investigation points to learn more, then you must build a scenario tree, anticipate how the consortium, the rival port and the dock workers respond, set a primary and fallback strategy, and decide. At the end, an adversarial reviewer will test your reasoning.",
    knownFacts: [
      "The port lost 4 million last year; the cranes are 28 years old.",
      "The consortium's members include a shipping line that also uses the rival port.",
      "The dock workers' union has 900 members and a history of strikes.",
      "The state's borrowing costs are high; a sovereign loan for new cranes would cost about 9 percent.",
    ],
    actions: [
      { id: "ca-financials", label: "Audit the port's accounts", description: "Understand why it loses money.", kind: "request_report", cost: 3, requiresEvidence: [] },
      { id: "ca-consortium", label: "Investigate the consortium's ownership", description: "Who really controls it, and what else do they own?", kind: "search", cost: 3, requiresEvidence: [] },
      { id: "ca-rival", label: "Study the rival port's expansion", description: "Capacity, timing and target customers.", kind: "request_report", cost: 2, requiresEvidence: [] },
      { id: "ca-union", label: "Meet the union leadership", description: "What would they accept?", kind: "interview", cost: 2, requiresEvidence: [] },
      { id: "ca-benchmark", label: "Benchmark comparable concessions", description: "Terms in similar deals elsewhere.", kind: "request_report", cost: 3, requiresEvidence: [] },
      { id: "ca-contract", label: "Get the draft contract reviewed", description: "Legal review of exclusivity, exit and tariff clauses.", kind: "request_report", cost: 4, requiresEvidence: ["ev-consortium"] },
      { id: "ca-shippers", label: "Survey the main importers", description: "What they need from the port.", kind: "interview", cost: 2, requiresEvidence: [] },
    ],
    budget: 10,
    expectedDimensions: ["hypothesis_generation", "information_gathering", "strategic_foresight", "planning", "risk_assessment", "decision_quality", "calibration"],
  },
  hidden: {
    challengeId: "chal-port-concession",
    version: 1,
    evidence: [
      { id: "ev-brief", title: "Ministerial brief", content: "The prime minister has publicly praised the consortium's offer. The cabinet expects a recommendation within three weeks.", source: "PM's office", kind: "document", reliability: "high", initial: true },
      { id: "ev-financials", title: "Port accounts", content: "Losses come from two sources: crane breakdowns causing ships to wait (demurrage claims of 2.1 million) and a tariff frozen since 2014. Wage costs are average for the region. A 15 percent tariff increase and reliable cranes would return the port to profit on current volumes.", source: "Auditor", kind: "report", reliability: "high", initial: false },
      { id: "ev-consortium", title: "Consortium ownership", content: "The consortium is 55 percent owned by a holding company that also owns 40 percent of the rival port's operator. The shipping line member routes most of its regional cargo through the rival port.", source: "Corporate registry", kind: "document", reliability: "high", initial: false },
      { id: "ev-rival", title: "Rival port expansion", content: "The rival port's new terminal opens in 18 months with capacity for three times the island's current volume. Its business plan counts on capturing transshipment cargo that currently uses the island.", source: "Industry analyst", kind: "report", reliability: "medium", initial: false },
      { id: "ev-union", title: "Union position", content: "The union will accept new equipment and modest headcount reduction through retirement if wages are protected and a share of concession revenue funds a training programme. They will strike against any lay-offs during the transition.", source: "Union leadership", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-benchmark", title: "Comparable concessions", content: "Similar ports have obtained 18–25 percent revenue shares, minimum investment milestones with clawbacks, and 20–25 year terms. Deals without volume commitments have sometimes been used by operators to divert traffic to sister ports.", source: "Development bank study", kind: "report", reliability: "high", initial: false },
      { id: "ev-contract", title: "Draft contract review", content: "The draft grants exclusivity for 30 years, contains no minimum-volume or investment-milestone clauses, allows the operator to set tariffs, and includes a change-of-control clause that would let the holding company assign the concession to an affiliate without state consent.", source: "External counsel", kind: "report", reliability: "high", initial: false },
      { id: "ev-shippers", title: "Importers' survey", content: "Importers care about reliability and predictable tariffs; most would accept a moderate tariff increase for reliable service. Several fear that a consortium tied to the rival port would let the island port decline.", source: "Chamber of commerce", kind: "testimony", reliability: "medium", initial: false },
    ],
    actionReveals: { "ca-financials": ["ev-financials"], "ca-consortium": ["ev-consortium"], "ca-rival": ["ev-rival"], "ca-union": ["ev-union"], "ca-benchmark": ["ev-benchmark"], "ca-contract": ["ev-contract"], "ca-shippers": ["ev-shippers"] },
    keyEvidenceIds: ["ev-consortium", "ev-contract", "ev-benchmark", "ev-financials"],
    referenceAnalysis:
      "The offer is structurally dangerous: the consortium is controlled by the rival port's part-owner, the draft contract has no volume or investment commitments and lets the operator set tariffs and assign the concession, and the rival's expansion depends on capturing exactly the cargo the island port now handles. The port's losses are fixable without a concession (tariff unfrozen, cranes replaced, perhaps financed by a development bank at better than 9 percent), which means the state's alternative to this deal is stronger than the prime minister's public position suggests. A strong recommendation therefore does not simply reject: it reframes. Primary strategy: run a competitive process with minimum terms (volume commitments, investment milestones with clawback, change-of-control consent, tariff regulation, 20–25 year term, 18 percent plus revenue share), while starting the crane financing and tariff reform in parallel so the state can walk away. Fallback: if no acceptable bidder appears, proceed with the state-led fix and revisit a concession in three years. Anticipated responses: the consortium lobbies the prime minister and offers a sweetener without changing structural clauses; the rival port accelerates; the union strikes only if lay-offs are announced. Decision: recommend against signing the draft, with the reframed process, and manage the political cost with the prime minister by giving him a better announcement than the one he has.",
    adversaryPersona: "You are a sceptical senior adviser who has seen many concession deals. You press on evidence, incentives, timing and what the adviser would do if their key assumption were wrong. Ask hard, specific questions about the adviser's actual reasoning; do not lecture.",
    rubric: [
      { id: "unknowns", title: "Knowns and unknowns", description: "Separated facts from assumptions and named what mattered most to find out.", weight: 2, skill: "hypothesis_generation", levels: [{ score: 0, descriptor: "Undifferentiated" }, { score: 1, descriptor: "Clear separation and prioritised unknowns" }] },
      { id: "information", title: "Information choices", description: "Spent points on ownership, contract and benchmarks rather than only on the obvious.", weight: 3, skill: "information_gathering", levels: [{ score: 0, descriptor: "Missed the ownership or contract evidence" }, { score: 0.5, descriptor: "Found one of them" }, { score: 1, descriptor: "Found both and used them" }] },
      { id: "anticipation", title: "Anticipated responses", description: "Predicted consortium, rival and union behaviour with probabilities and triggers.", weight: 3, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "None" }, { score: 0.5, descriptor: "Named without triggers" }, { score: 1, descriptor: "Named with probabilities and triggers" }] },
      { id: "strategy", title: "Primary and fallback", description: "Primary strategy strengthens the state's alternative; fallback is concrete and affordable.", weight: 3, skill: "planning", levels: [{ score: 0, descriptor: "Accept or reject only" }, { score: 0.5, descriptor: "Reframed without fallback" }, { score: 1, descriptor: "Reframed with fallback and parallel actions" }] },
      { id: "risk", title: "Risk and assumptions", description: "Named the load-bearing assumptions and what would falsify them.", weight: 2, skill: "risk_assessment", levels: [{ score: 0, descriptor: "Unstated" }, { score: 1, descriptor: "Stated with tests" }] },
      { id: "decision", title: "Decision coherence", description: "The decision follows from the evidence and strategy, with honest confidence.", weight: 3, skill: "decision_quality", levels: [{ score: 0, descriptor: "Disconnected" }, { score: 0.5, descriptor: "Follows but overconfident" }, { score: 1, descriptor: "Coherent and calibrated" }] },
      { id: "defence", title: "Adversarial defence", description: "Answered the reviewer's questions with evidence and acknowledged uncertainty.", weight: 2, skill: "calibration", levels: [{ score: 0, descriptor: "Deflected" }, { score: 1, descriptor: "Engaged with evidence and limits" }] },
    ],
    debrief:
      "The challenge tests whether you investigate the deal's structure before its headline number, whether you notice that the state's alternative is better than it looks, and whether you can turn 'no' into a better process rather than a confrontation with the prime minister. Attempts that spent their points on the union and the shippers learned useful things but missed the two facts that decide the case: who controls the consortium, and what the contract fails to require.",
  },
};

export const CHALLENGES: readonly ChallengeDefinition[] = [portConcession];

export function listPublishedChallenges(): ChallengePublic[] {
  return CHALLENGES.filter((c) => c.public.status === "published").map((c) => c.public);
}
export function findChallenge(id: string): ChallengeDefinition | null {
  return CHALLENGES.find((c) => c.public.id === id) ?? null;
}
export function validateChallenges(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const c of CHALLENGES) {
    const r = ChallengeDefinition.safeParse(c);
    if (!r.success) { errors.push(`${c.public.id}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`); continue; }
    const ev = new Set(c.hidden.evidence.map((e) => e.id));
    for (const a of c.public.actions) {
      if (!c.hidden.actionReveals[a.id]?.length) errors.push(`${c.public.id}: action ${a.id} reveals nothing`);
      for (const id of c.hidden.actionReveals[a.id] ?? []) if (!ev.has(id)) errors.push(`${c.public.id}: unknown evidence ${id}`);
      for (const req of a.requiresEvidence) if (!ev.has(req)) errors.push(`${c.public.id}: unknown prerequisite ${req}`);
    }
    for (const k of c.hidden.keyEvidenceIds) if (!ev.has(k)) errors.push(`${c.public.id}: unknown key evidence ${k}`);
    const rubricSkills = new Set(c.hidden.rubric.map((x) => x.skill));
    for (const d of c.public.expectedDimensions) if (!rubricSkills.has(d)) errors.push(`${c.public.id}: expectedDimension ${d} has no rubric criterion`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
