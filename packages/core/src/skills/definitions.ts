import type { SkillId } from "@lunara/schemas";

/**
 * Every skill metric has an explicit definition, scoring method and evidence
 * source. These are shown to users on the profile screen so no number is
 * unexplained. None of these is an intelligence measure.
 */
export interface SkillDefinition {
  id: SkillId;
  label: string;
  definition: string;
  scoringMethod: string;
  evidenceSource: string;
}

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  hypothesis_generation: {
    id: "hypothesis_generation",
    label: "Hypothesis generation",
    definition: "Produces multiple distinct, testable explanations or plans rather than committing to one early.",
    scoringMethod: "Rubric criteria tagged with this skill, weighted; number and distinctness of hypotheses recorded in the session.",
    evidenceSource: "Hypothesis workspace entries and coach-assessed rubric scores.",
  },
  evidence_evaluation: {
    id: "evidence_evaluation",
    label: "Evidence evaluation",
    definition: "Weighs how strongly each piece of evidence supports or contradicts a claim, and notices what is missing.",
    scoringMethod: "Rubric criteria tagged with this skill; explicit evidence links on hypotheses.",
    evidenceSource: "Evidence links and debrief assessment.",
  },
  logical_validity: {
    id: "logical_validity",
    label: "Logical validity",
    definition: "Distinguishes what necessarily follows from premises from what merely seems reasonable.",
    scoringMethod: "Fixed-answer deduction exercises: correctness plus rubric on justification.",
    evidenceSource: "Deduction exercise outcomes.",
  },
  strategic_foresight: {
    id: "strategic_foresight",
    label: "Strategic foresight",
    definition: "Anticipates responses by other agents and second-order consequences.",
    scoringMethod: "Rubric criteria on anticipated responses and contingencies.",
    evidenceSource: "Strategy exercises, scenario trees and simulations.",
  },
  planning: {
    id: "planning",
    label: "Planning",
    definition: "Sequences actions toward an objective under constraints, with milestones and dependencies.",
    scoringMethod: "Rubric criteria on sequencing, feasibility and constraint handling.",
    evidenceSource: "Strategic planning exercises and missions.",
  },
  risk_assessment: {
    id: "risk_assessment",
    label: "Risk assessment",
    definition: "Identifies failure points, their likelihood and impact, and prepares mitigations.",
    scoringMethod: "Rubric criteria on identified risks and mitigations.",
    evidenceSource: "Planning and simulation debriefs.",
  },
  information_gathering: {
    id: "information_gathering",
    label: "Information gathering",
    definition: "Chooses investigative actions that most reduce uncertainty for their cost.",
    scoringMethod: "Value of information actions relative to scenario ground truth; rubric otherwise.",
    evidenceSource: "Inference Lab actions and coaching sessions.",
  },
  negotiation: {
    id: "negotiation",
    label: "Negotiation",
    definition: "Identifies interests, alternatives and leverage, and trades concessions deliberately.",
    scoringMethod: "Rubric criteria in negotiation role-play debriefs.",
    evidenceSource: "Negotiation sessions.",
  },
  calibration: {
    id: "calibration",
    label: "Calibration",
    definition: "Stated confidence matches observed accuracy over time.",
    scoringMethod: "Brier score on fixed-answer questions with stated probabilities; shown only with enough data.",
    evidenceSource: "Confidence entries on hypotheses and decisions with known outcomes.",
  },
  adaptability: {
    id: "adaptability",
    label: "Adaptability",
    definition: "Revises beliefs and plans proportionately when new evidence arrives.",
    scoringMethod: "Rubric criteria on revision quality; presence of justified revisions after challenge.",
    evidenceSource: "Revision phase behaviour and simulation turns.",
  },
  systems_thinking: {
    id: "systems_thinking",
    label: "Systems thinking",
    definition: "Reasons about feedback loops, delays and interactions rather than isolated causes.",
    scoringMethod: "Rubric criteria tagged with this skill.",
    evidenceSource: "Systems and long-term planning exercises.",
  },
  decision_quality: {
    id: "decision_quality",
    label: "Decision quality",
    definition: "Decisions are coherent with objectives, evidence and stated uncertainty, independent of luck.",
    scoringMethod: "Rubric on objective alignment and reasoning; outcome quality classification separates luck from judgement.",
    evidenceSource: "Final decisions and their debriefs.",
  },
  learning_retention: {
    id: "learning_retention",
    label: "Learning retention",
    definition: "Recalls and applies previously learned concepts and techniques.",
    scoringMethod: "Spaced-repetition recall quality (later phase).",
    evidenceSource: "Review sessions.",
  },
};

export function skillLabel(id: SkillId): string {
  return SKILL_DEFINITIONS[id].label;
}
