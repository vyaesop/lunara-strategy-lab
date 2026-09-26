import { MissionDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

export const launchMission: MissionDefinition = {
  schemaVersion: 1,
  createdAt: CREATED,
  updatedAt: CREATED,
  id: "mis-limited-launch",
  slug: "limited-launch",
  version: 1,
  status: "published",
  source: "curated",
  title: "Launch with limited resources",
  summary: "Take a product from 'we should launch' to a decision you can defend, in six connected steps.",
  difficulty: 3,
  estimatedMinutes: 90,
  objectives: ["Turn a vague goal into measurable success criteria", "Sequence learning before commitment", "Leave the mission with a decision, predictions, and a review date"],
  constraints: ["Use a real or realistic product of your own; the steps ask for your specifics.", "Keep each step under fifteen minutes."],
  steps: [
    { id: "st-criteria", title: "Define success", kind: "reflection", prompt: "Describe the launch you are considering. Then write the success criterion a sceptical board member would accept, with a number and a date.", guidance: "If you cannot attach a number, you have not defined success yet.", exerciseId: null },
    { id: "st-plan", title: "Map the sequence", kind: "tree", prompt: "Build a scenario tree: the launch decision, at least two competitor or market responses, one information-gathering action that happens before you commit, and a contingency for the worst branch. Link the tree here.", guidance: "Use the Scenario Trees tool, then run a structural critique before linking.", exerciseId: null },
    { id: "st-exercise", title: "Practice the pattern", kind: "exercise", prompt: "Complete the Regional Launch exercise and note in one paragraph what its debrief changes in your own plan.", guidance: "", exerciseId: "ex-regional-launch" },
    { id: "st-council", title: "Adversarial review", kind: "council", prompt: "Bring your plan to the War Room with at least the Skeptic and the Opponent enabled. Record which points you accept, reject or will investigate.", guidance: "", exerciseId: null },
    { id: "st-decision", title: "Decide", kind: "decision", prompt: "Log the decision in the journal: context, alternatives, chosen action, rationale, risks, confidence, and a review date.", guidance: "", exerciseId: null },
    { id: "st-predictions", title: "Predict", kind: "prediction", prompt: "Write three concrete predictions about the first month after launch, each with a probability and the evidence that would prove it wrong.", guidance: "Binary, checkable, dated.", exerciseId: null },
  ],
  rubric: [
    { id: "criteria", title: "Measurable success", description: "Success criterion has a number and a date and is defensible.", weight: 2, skill: "planning", levels: [{ score: 0, descriptor: "Vague" }, { score: 1, descriptor: "Number, date, rationale" }] },
    { id: "sequence", title: "Learning before commitment", description: "The plan gathers cheap information before expensive steps.", weight: 3, skill: "information_gathering", levels: [{ score: 0, descriptor: "Commits first" }, { score: 0.5, descriptor: "Some learning steps" }, { score: 1, descriptor: "Explicit decision point after learning" }] },
    { id: "anticipation", title: "Anticipated responses", description: "Competitor or market responses are named with a contingency.", weight: 2, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "None" }, { score: 1, descriptor: "Named with contingency" }] },
    { id: "closure", title: "Decision and predictions", description: "Ends with a logged decision and checkable predictions.", weight: 2, skill: "decision_quality", levels: [{ score: 0, descriptor: "No decision" }, { score: 1, descriptor: "Decision, predictions, review date" }] },
  ],
  expectedDimensions: ["planning", "information_gathering", "strategic_foresight", "decision_quality"],
  projectId: null,
};

export const competitorMission: MissionDefinition = {
  schemaVersion: 1,
  createdAt: CREATED,
  updatedAt: CREATED,
  id: "mis-competitor-move",
  slug: "competitor-move",
  version: 1,
  status: "published",
  source: "curated",
  title: "Respond to a competitor's move",
  summary: "A rival just did something that worries you. Work out what it means before deciding what to do about it.",
  difficulty: 3,
  estimatedMinutes: 60,
  objectives: ["Separate what the move proves from what it suggests", "Model the rival's incentives before reacting", "Choose a response with a trigger for changing it"],
  constraints: ["Use a real or realistic rival move.", "Do not decide in the first two steps."],
  steps: [
    { id: "st-facts", title: "What do you actually know?", kind: "reflection", prompt: "Describe the move. List what is established, what is inferred, and what you are assuming about why they did it.", guidance: "Three separate lists.", exerciseId: null },
    { id: "st-explanations", title: "Competing explanations", kind: "plan", prompt: "Write at least three different reasons the rival might have made this move, and for each, what you would expect to see next if it were true.", guidance: "Distinct mechanisms, not variations.", exerciseId: null },
    { id: "st-exercise", title: "Practice the pattern", kind: "exercise", prompt: "Complete The Silent Server exercise (abduction) and note what its method changes in your list of explanations.", guidance: "", exerciseId: "ex-silent-server" },
    { id: "st-options", title: "Options and responses", kind: "tree", prompt: "Build a tree with your candidate responses, the rival's likely counter to each, and the cheapest test that tells you which explanation is true. Link it here.", guidance: "", exerciseId: null },
    { id: "st-decision", title: "Decide, with a trigger", kind: "decision", prompt: "Log the decision: what you will do now, the evidence that would make you change course, and a review date.", guidance: "", exerciseId: null },
  ],
  rubric: [
    { id: "separation", title: "Facts versus inference", description: "Clearly separates established facts from inferences and assumptions.", weight: 2, skill: "evidence_evaluation", levels: [{ score: 0, descriptor: "Mixed" }, { score: 1, descriptor: "Separated" }] },
    { id: "explanations", title: "Competing explanations", description: "Three distinct explanations with observable consequences.", weight: 3, skill: "hypothesis_generation", levels: [{ score: 0, descriptor: "One" }, { score: 0.5, descriptor: "Two" }, { score: 1, descriptor: "Three with predictions" }] },
    { id: "trigger", title: "Response with a trigger", description: "Chosen response includes what would change it.", weight: 3, skill: "adaptability", levels: [{ score: 0, descriptor: "No trigger" }, { score: 1, descriptor: "Explicit trigger and date" }] },
  ],
  expectedDimensions: ["evidence_evaluation", "hypothesis_generation", "adaptability"],
  projectId: null,
};

export const MISSIONS: readonly MissionDefinition[] = [launchMission, competitorMission];

export function listPublishedMissions(): MissionDefinition[] {
  return MISSIONS.filter((m) => m.status === "published");
}

export function findMission(id: string): MissionDefinition | null {
  return MISSIONS.find((m) => m.id === id) ?? null;
}

export function validateMissions(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const m of MISSIONS) {
    const r = MissionDefinition.safeParse(m);
    if (!r.success) errors.push(`${m.id}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const rubricSkills = new Set(m.rubric.map((c) => c.skill));
    for (const d of m.expectedDimensions) if (!rubricSkills.has(d)) errors.push(`${m.id}: expectedDimension ${d} has no rubric criterion`);
    for (const s of m.steps) if (s.kind === "exercise" && !s.exerciseId) errors.push(`${m.id}/${s.id}: exercise step without exerciseId`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
