import type { InvestigationDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/**
 * Fictional case with an answer key. Trains abduction with competing
 * explanations, evidence linking, and information-gathering choices under
 * a point budget. Ground truth: an electrical fault in an overloaded
 * extension lead, not arson; the "arson" evidence is a red herring.
 */
export const warehouseFire: InvestigationDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "inv-warehouse-fire",
    slug: "warehouse-fire",
    version: 1,
    status: "published",
    kind: "fictional",
    title: "The Warehouse Fire",
    summary: "A textile warehouse burned overnight. The owner blames a disgruntled ex-employee; the insurer suspects the owner. Uncover evidence with a limited budget and decide what the evidence actually supports.",
    difficulty: 3,
    estimatedMinutes: 30,
    learningObjectives: [
      "Maintain at least three competing explanations until the evidence discriminates between them",
      "Link every claim to specific evidence and note what contradicts it",
      "Spend investigation points on actions that discriminate rather than confirm",
    ],
    briefing:
      "At 03:40 a fire destroyed most of Halden Textiles, a single-storey warehouse on an industrial estate. Nobody was hurt. The owner, Petra Halden, told the fire service the blaze must have been set by Jonas Reyes, a storeman she dismissed two weeks ago after a dispute over unpaid overtime. The insurer's assessor has separately noted that the business was behind on rent and that the policy was increased four months ago. You are the independent investigator retained by the insurer's solicitors. You have 12 investigation points. Your job is to determine, as far as the evidence allows, how the fire started and whether any person is responsible, and to say clearly what remains uncertain.",
    knownFacts: [
      "The fire service's initial call log: alarm from a neighbouring unit at 03:40; the warehouse's own alarm did not trigger a monitored call.",
      "The warehouse stored bolts of cotton and polyester, solvent-based dyes in a locked cage, and packing materials.",
      "Petra Halden was at home eight miles away according to her statement; Jonas Reyes says he was at a friend's flat.",
    ],
    entities: [
      { id: "ent-petra", name: "Petra Halden", role: "Owner", description: "Runs the business; policy increased four months ago; rent arrears.", candidate: true },
      { id: "ent-jonas", name: "Jonas Reyes", role: "Dismissed storeman", description: "Dismissed two weeks ago after an overtime dispute; still had a key until last week.", candidate: true },
      { id: "ent-electrical", name: "Electrical fault (accidental)", role: "Explanation", description: "Fire started by an electrical fault without anyone's intent.", candidate: true },
      { id: "ent-other", name: "Other or undetermined", role: "Explanation", description: "Some other cause, or the evidence cannot determine one.", candidate: true },
      { id: "ent-firechief", name: "Station officer Amari", role: "Fire service", description: "Led the response; can be interviewed.", candidate: false },
      { id: "ent-neighbour", name: "Dev Okafor", role: "Neighbouring unit owner", description: "Raised the alarm; works late most nights.", candidate: false },
    ],
    actions: [
      { id: "act-scene", label: "Walk the fire scene with the station officer", description: "Inspect burn patterns and where the fire appears to have started.", kind: "inspect", cost: 2, requiresEvidence: [] },
      { id: "act-interview-petra", label: "Interview Petra Halden", description: "Her account of the business, the policy and Jonas.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-interview-jonas", label: "Interview Jonas Reyes", description: "His account of the dismissal and his whereabouts.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-interview-neighbour", label: "Interview Dev Okafor", description: "What the neighbour saw and heard before raising the alarm.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-lab", label: "Commission an accelerant analysis", description: "Laboratory test of debris from the origin area for ignitable liquid residue.", kind: "test", cost: 4, requiresEvidence: ["ev-origin"] },
      { id: "act-electrical", label: "Request an electrical engineer's report", description: "Examination of wiring and appliances recovered from the origin area.", kind: "request_report", cost: 3, requiresEvidence: ["ev-origin"] },
      { id: "act-alarm", label: "Pull the alarm company's records", description: "Why the monitored alarm did not call out.", kind: "request_report", cost: 2, requiresEvidence: [] },
      { id: "act-cctv", label: "Obtain the estate's gate CCTV", description: "Vehicle and pedestrian movements at the estate entrance overnight.", kind: "search", cost: 3, requiresEvidence: [] },
      { id: "act-finance", label: "Review the company's accounts", description: "Cash position, rent arrears and the insurance history.", kind: "search", cost: 2, requiresEvidence: [] },
      { id: "act-phone", label: "Check Jonas's phone location", description: "Request location records for the night (requires his consent or a court order).", kind: "request_report", cost: 3, requiresEvidence: ["ev-jonas-account"] },
    ],
    budget: 12,
    expectedDimensions: ["hypothesis_generation", "evidence_evaluation", "information_gathering", "calibration"],
    tags: ["investigation", "abduction", "fire"],
  },
  hidden: {
    investigationId: "inv-warehouse-fire",
    version: 1,
    evidence: [
      { id: "ev-callout", title: "Fire service call log", content: "Alarm raised by phone from the neighbouring unit at 03:40. First appliance on scene 03:52. Roof partially collapsed by 04:10. No monitored alarm signal was received from Halden Textiles.", source: "Fire service", kind: "document", reliability: "high", initial: true },
      { id: "ev-petra-statement", title: "Petra Halden's initial statement", content: "States she was at home from 21:00. Says Jonas Reyes threatened 'you'll regret this' when dismissed and still had a key until it was returned 'sometime last week'. Mentions the business was 'tight but fine'.", source: "Petra Halden", kind: "testimony", reliability: "low", initial: true },
      { id: "ev-origin", title: "Scene examination", content: "Lowest and most severe burning is at the north-east corner near the packing bench, where an extension lead ran under stacked cardboard to a space heater and a battery charger. V-pattern on the wall above the bench. No evidence of forced entry at either door; the dye cage lock is intact and the cage contents largely survived.", source: "Station officer Amari", kind: "observation", reliability: "high", initial: false },
      { id: "ev-petra-interview", title: "Interview: Petra Halden", content: "Repeats the accusation against Jonas. Confirms the space heater was left running overnight 'sometimes' because the stock must not get damp. Says the alarm contract 'lapsed, I think, I was going to sort it'. When asked about the policy increase, says stock levels had grown.", source: "Petra Halden", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-jonas-account", title: "Interview: Jonas Reyes", content: "Angry about the dismissal and says he is still owed overtime. Says he returned his key eight days before the fire and has a photo of the key on Petra's desk with the date. Says he was at a friend's flat across town until about 02:00 and then walked home; the friend can confirm the evening but not the walk.", source: "Jonas Reyes", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-neighbour", title: "Interview: Dev Okafor", content: "Working late on a delivery. At about 03:15 noticed a 'flickering orange glow' through the high windows of Halden's north-east corner and assumed it was a light left on. Did not see anyone on the estate road between 01:00 and 03:40. Smelled 'burning plastic, then everything' when he went out at 03:38.", source: "Dev Okafor", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-lab", title: "Accelerant analysis", content: "Debris from the origin area: no ignitable liquid residue detected. Note: solvent dyes were stored in a separate cage that did not burn, so their absence at the origin is meaningful.", source: "Forensic laboratory", kind: "report", reliability: "high", initial: false },
      { id: "ev-electrical", title: "Electrical engineer's report", content: "Recovered extension lead shows arc beads consistent with a fault while energised. The lead was rated 10 A; the space heater alone draws 8.7 A and the charger a further 2 A. The lead ran under cardboard, restricting cooling. Conclusion: an overloaded, insulated extension lead is a probable ignition source at this location.", source: "Electrical engineer", kind: "report", reliability: "high", initial: false },
      { id: "ev-alarm", title: "Alarm company records", content: "Monitoring contract cancelled for non-payment eleven weeks ago. The panel still sounded locally but no call-out was made.", source: "Alarm company", kind: "document", reliability: "high", initial: false },
      { id: "ev-cctv", title: "Estate gate CCTV", content: "Petra Halden's car left the estate at 19:10 and did not return before the fire. No pedestrians or vehicles entered between 22:30 and 03:45 except Dev Okafor's van (returning 22:05, still present). The gate camera does not cover the rear footpath.", source: "Estate management", kind: "document", reliability: "high", initial: false },
      { id: "ev-finance", title: "Company accounts summary", content: "Rent three months in arrears. Insurance cover increased four months ago after a stock valuation by a broker; the valuation matches purchase invoices. Cash flow negative for two quarters but a new order was signed last week.", source: "Accountant", kind: "document", reliability: "high", initial: false },
      { id: "ev-phone", title: "Phone location records", content: "Jonas's phone was at his friend's flat until 02:05 and at his own address from 02:50 onward, four miles from the estate in the opposite direction. No record places it near the estate.", source: "Network operator", kind: "report", reliability: "high", initial: false },
    ],
    actionReveals: {
      "act-scene": ["ev-origin"],
      "act-interview-petra": ["ev-petra-interview"],
      "act-interview-jonas": ["ev-jonas-account"],
      "act-interview-neighbour": ["ev-neighbour"],
      "act-lab": ["ev-lab"],
      "act-electrical": ["ev-electrical"],
      "act-alarm": ["ev-alarm"],
      "act-cctv": ["ev-cctv"],
      "act-finance": ["ev-finance"],
      "act-phone": ["ev-phone"],
    },
    groundTruth: {
      answerEntityId: "ent-electrical",
      summary:
        "The fire started at the north-east packing bench from an overloaded 10 A extension lead feeding a space heater and a charger, insulated under cardboard, which arced and ignited the packing materials. The scene (origin at the bench, V-pattern, no forced entry, dye cage intact), the negative accelerant result, the engineer's arc-bead finding and the neighbour's early orange glow at that corner all converge. Petra's accusation against Jonas is unsupported: the key was returned, CCTV shows no entry, and phone records place him elsewhere. The insurer's suspicion of Petra rests on motive (arrears, policy increase) but the policy increase matches a real stock valuation, she left the estate at 19:10, and there is no accelerant. What remains uncertain is whether leaving the heater running overnight on an overloaded lead amounts to negligence relevant to the policy; that is a legal question the evidence cannot settle.",
      keyEvidenceIds: ["ev-origin", "ev-lab", "ev-electrical", "ev-cctv"],
      misleadingEvidenceIds: ["ev-petra-statement", "ev-finance"],
    },
    rubric: [
      { id: "competing", title: "Competing explanations", description: "Kept arson-by-Jonas, arson-by-owner and accidental fault alive until evidence discriminated.", weight: 2, skill: "hypothesis_generation", levels: [{ score: 0, descriptor: "Single explanation" }, { score: 0.5, descriptor: "Two" }, { score: 1, descriptor: "Three distinct, with evidence links each" }] },
      { id: "discriminating", title: "Discriminating actions", description: "Spent points on scene, lab and electrical findings that separate accident from arson, rather than only on interviews that confirm suspicion.", weight: 3, skill: "information_gathering", levels: [{ score: 0, descriptor: "Confirmatory interviews only" }, { score: 0.5, descriptor: "Scene examined but no forensic follow-up" }, { score: 1, descriptor: "Scene plus lab or engineer report, chosen with a stated purpose" }] },
      { id: "weighing", title: "Weighing reliability", description: "Treated the owner's statement and the financial motive as weak evidence and the forensic reports as strong.", weight: 3, skill: "evidence_evaluation", levels: [{ score: 0, descriptor: "Motive treated as proof" }, { score: 0.5, descriptor: "Reliability noted inconsistently" }, { score: 1, descriptor: "Explicit weighing; misleading items linked as weak or contradicting" }] },
      { id: "uncertainty", title: "Stated uncertainty", description: "Conclusion states what remains undetermined (negligence, exact ignition sequence) with calibrated confidence.", weight: 2, skill: "calibration", levels: [{ score: 0, descriptor: "Certain verdict" }, { score: 1, descriptor: "Confidence matches evidence and residual uncertainty named" }] },
    ],
    hints: [
      "Your task is to say what the evidence supports about how the fire started, not to decide who you find suspicious. Keep at least three explanations open.",
      "Some actions confirm what you already believe; others can rule an explanation out. Spend your first points on the kind that can rule things out.",
      "The scene examination points at one corner and one piece of equipment. Which follow-up actions become available once you have it, and what would each result mean?",
      "Weigh each item by its source: an owner with a grievance and an accountant's summary of motive are not the same kind of evidence as a laboratory or an engineer.",
      "Worked reasoning: origin at the packing bench with an overloaded lead under cardboard; no accelerant; engineer finds arc beads; CCTV shows no one entered and Petra left at 19:10; Jonas's key was returned and his phone was elsewhere. The best-supported explanation is an accidental electrical fault. Motive evidence against Petra is real but does not touch the physical cause. Remaining uncertainty: whether running the heater on that lead was negligent.",
    ],
    debrief:
      "The case is built to reward two habits. First, resisting the pull of a named suspect: both parties handed you a villain, and the cheapest actions (interviews) mostly produce more accusation. The expensive actions (scene, lab, engineer) are the ones that can actually distinguish accident from arson, and a good investigator buys discrimination, not confirmation. Second, weighing sources: the accounts summary is accurate and establishes motive, yet motive is compatible with every explanation and says nothing about how the fire started; the forensic reports speak directly to cause. Investigators who linked the owner's statement or the finances as strong support for arson were misled by relevance without discriminating power. Finally, note what a calibrated conclusion looks like here: high confidence in an electrical origin, and an explicit statement that negligence is a separate question the evidence does not settle.",
    coachNotes: "If the learner spends early points on interviews only, ask which explanation those interviews could rule out. If they conclude arson from motive, ask what physical evidence distinguishes arson from accident and whether they have it.",
  },
};
