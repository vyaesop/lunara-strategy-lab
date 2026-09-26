import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-25T00:00:00.000Z";

/**
 * Critical thinking, open rubric. Trains evidence evaluation: selection,
 * survivorship, base rates, and what data would actually test the claim.
 */
export const miracleCohort: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-miracle-cohort",
    slug: "miracle-cohort",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Miracle Cohort",
    summary:
      "A training programme reports that 90 percent of graduates land jobs within three months. Decide how much the claim is worth and what evidence would actually test it.",
    mode: "critical_thinking",
    difficulty: 2,
    answerKind: "open",
    estimatedMinutes: 15,
    learningObjectives: [
      "Identify selection and survivorship effects in a headline statistic",
      "Ask for the comparison and the denominator before accepting a rate",
      "Specify the evidence that would change your assessment",
    ],
    scenario:
      "A twelve-week coding bootcamp advertises that 90 percent of its graduates are employed as software developers within three months of finishing. A friend is deciding whether to pay the fee and asks for your honest read. You can see the programme's published report and a few other facts below. Your task is to explain what the 90 percent figure does and does not tell you, what alternative explanations could produce it, and what specific information you would ask for before advising your friend.",
    facts: [
      "The published report counts 'graduates', defined as students who complete all twelve weeks and pass the final project.",
      "Roughly 40 percent of enrolled students do not graduate; the report does not describe their outcomes.",
      "Admission requires a technical interview; the programme accepts about one in five applicants.",
      "'Employed as a software developer' includes part-time roles, contract roles and roles at the programme's own partner companies.",
      "The report was compiled from graduates who responded to a survey; the response rate is not stated.",
      "The regional employment rate for people with a technical background who search actively for three months is not given in the report.",
    ],
    constraints: [
      "Do not assume the programme is dishonest; treat every fact as accurate.",
      "Your answer must include what evidence would raise or lower your assessment, not only objections.",
    ],
    expectedDimensions: ["evidence_evaluation", "hypothesis_generation", "calibration"],
    tags: ["statistics", "selection-bias", "evidence"],
  },
  hidden: {
    exerciseId: "ex-miracle-cohort",
    version: 1,
    solution:
      "Reference analysis. The 90 percent figure is the share of survey respondents among graduates who report any developer-adjacent role within three months. At least four filters sit between an applicant and that number: selective admission (one in five), non-completion (40 percent), survey non-response (unknown), and a broad outcome definition (part-time, contract and partner placements). Each filter plausibly raises the reported rate without the programme adding value. The claim your friend cares about, 'if I enrol, how likely am I to get a developer job that I would not have got otherwise', is not answered by the report. Alternative explanations for the 90 percent: the admissions filter selects people who would have succeeded anyway; the dropouts include most who struggle; non-respondents skew unemployed; partner placements are short-term. Evidence that would move the assessment up: outcomes for all enrolled students (intent-to-treat), a stated survey response rate near 100 percent or verified employment records, outcomes six and twelve months out, salary and full-time share, and a comparison group of accepted applicants who did not enrol. Evidence that would move it down: low response rate, high share of partner or contract placements, poor twelve-month retention. A calibrated conclusion states a range for the friend's chance rather than a point, and names the two or three facts that would tighten it most.",
    keyInsights: [
      "The denominator is respondents among graduates, not enrolled students; that is the whole game.",
      "Selective admission means the programme may be measuring who it admits, not what it teaches.",
      "The outcome definition is broad enough to inflate the number materially.",
      "The right question for the friend is a counterfactual: what happens to people like me who do not enrol?",
    ],
    commonErrors: [
      "Dismissing the claim as marketing without saying what evidence would change your mind.",
      "Accepting the figure because the facts are all true.",
      "Noticing the dropouts but missing the admissions filter or the outcome definition.",
      "Giving a point estimate for the friend without a range or the assumptions behind it.",
    ],
    rubric: [
      {
        id: "denominator",
        title: "Denominator and filters",
        description: "Identifies the population the 90 percent describes and the filters that produced it.",
        weight: 3,
        skill: "evidence_evaluation",
        levels: [
          { score: 0, descriptor: "Takes the rate at face value" },
          { score: 0.5, descriptor: "Names one filter" },
          { score: 1, descriptor: "Names admission, completion, response and definition filters" },
        ],
      },
      {
        id: "alternatives",
        title: "Alternative explanations",
        description: "Offers distinct mechanisms that could produce the figure without programme effect.",
        weight: 2,
        skill: "hypothesis_generation",
        levels: [
          { score: 0, descriptor: "None" },
          { score: 0.5, descriptor: "One" },
          { score: 1, descriptor: "Two or more, clearly distinct" },
        ],
      },
      {
        id: "evidence",
        title: "Evidence that would change the assessment",
        description: "Specifies concrete data that would raise or lower confidence.",
        weight: 2,
        skill: "evidence_evaluation",
        levels: [
          { score: 0, descriptor: "No evidence named" },
          { score: 0.5, descriptor: "Generic requests" },
          { score: 1, descriptor: "Specific data in both directions" },
        ],
      },
      {
        id: "calibration",
        title: "Calibrated conclusion",
        description: "States uncertainty honestly, as a range or conditional, rather than a verdict.",
        weight: 1,
        skill: "calibration",
        levels: [
          { score: 0, descriptor: "Overconfident verdict either way" },
          { score: 1, descriptor: "Range or conditional with stated assumptions" },
        ],
      },
    ],
    hints: [
      "The question is not whether the number is true. It is what population it describes and whether that population resembles your friend.",
      "Trace the path from 'applicant' to 'counted in the 90 percent'. How many steps are there, and who drops out at each?",
      "Look at the definition of 'employed as a software developer' and at who answered the survey. Which of these could raise the figure without anyone lying?",
      "Frame it as a counterfactual: what would happen to people like your friend who are accepted but do not enrol? What data would approximate that?",
      "Worked analysis: the rate is respondents among graduates among admitted applicants, with a broad outcome definition. Four filters, each plausibly inflating the number. The friend's real question is causal and unanswered. Ask for intent-to-treat outcomes, response rate or verified records, twelve-month outcomes and full-time share, and a comparison of accepted non-enrollees. Give a range, not a verdict.",
    ],
    debrief:
      "Every fact in the report can be true and the headline can still be nearly useless for your friend's decision. That is the central lesson: a statistic is only as informative as its denominator and its comparison. You should be able to name the four filters (admission, completion, response, definition) from memory after this exercise, because they recur in almost every reported success rate, from clinical outcomes to fund performance. The second lesson is about your own reasoning: the best answers did not stop at scepticism. They said what evidence would make the programme look good, which is what keeps critical thinking from collapsing into contrarianism. A calibrated answer gives the friend a range, tells them which two facts would narrow it most, and suggests they ask the programme for exactly those.",
    coachNotes:
      "If the user attacks the programme's honesty, redirect: all facts are true. Ask what population the number describes. If they find one filter, ask whether there are others. In the revision phase insist on evidence in both directions and on a range rather than a verdict.",
  },
};
