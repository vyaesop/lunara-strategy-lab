import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/** Bayesian reasoning, fixed answer with a defensible numeric range: base rates and belief updating. */
export const positiveTest: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-positive-test",
    slug: "positive-test",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Positive Screen",
    summary: "A supplier-fraud screening tool flags one invoice. Work out how much to believe the flag, what a second signal does to that belief, and what would actually settle it.",
    mode: "bayesian_reasoning",
    difficulty: 3,
    answerKind: "fixed",
    estimatedMinutes: 20,
    learningObjectives: [
      "Start from the base rate before weighing a positive signal",
      "Update a belief with a second, partly independent signal",
      "Say what evidence would change the conclusion, and by roughly how much",
    ],
    scenario:
      "Your finance team runs an automated screen over supplier invoices to flag possible fraud. This morning it flagged one invoice from a long-standing supplier. A colleague wants to freeze all payments to that supplier immediately. You have the tool's measured performance and some facts about the supplier. Your task is to estimate, with reasoning, how likely it is that this invoice is actually fraudulent; then update that estimate for the second signal below; then say what you would do and what evidence would settle the question.",
    facts: [
      "Historically about 1 in 500 invoices processed by the company turns out to be fraudulent.",
      "In validation, the screen flagged 90 percent of known fraudulent invoices (sensitivity 0.90).",
      "In validation, the screen flagged 4 percent of legitimate invoices (false-positive rate 0.04).",
      "Second signal: the flagged invoice's bank account number differs from the account used for the previous 40 invoices from this supplier. In past cases, a changed account appeared in roughly 60 percent of fraudulent invoices and in about 3 percent of legitimate ones (suppliers do change banks).",
      "The supplier has been paid 40 times over three years without incident.",
      "Freezing payments would delay a shipment the operations team says is time-critical.",
    ],
    constraints: [
      "Use the numbers given; do not introduce probabilities that are not supported by the facts.",
      "Treat the two signals as approximately independent for this exercise, and say that you are doing so.",
    ],
    expectedDimensions: ["calibration", "evidence_evaluation", "decision_quality"],
    tags: ["bayes", "base-rate", "fraud"],
  },
  hidden: {
    exerciseId: "ex-positive-test",
    version: 1,
    solution:
      "Step 1, the flag alone. Per 10,000 invoices: about 20 are fraudulent and 9,980 legitimate. The screen flags 0.9 × 20 = 18 fraudulent and 0.04 × 9,980 ≈ 399 legitimate. So a flagged invoice is fraudulent with probability 18 / (18 + 399) ≈ 4.3 percent. The base rate dominates: most flags are false positives. Step 2, the changed bank account, treated as roughly independent: likelihood ratio ≈ 0.60 / 0.03 = 20. Prior odds after the flag ≈ 18:399 ≈ 0.045; posterior odds ≈ 0.045 × 20 ≈ 0.90; posterior probability ≈ 0.90 / 1.90 ≈ 47 percent. A defensible answer lands in the 40–55 percent range depending on rounding. Step 3, action. A roughly even chance of fraud on one invoice justifies a targeted, cheap verification rather than freezing all payments: call the supplier on a known, previously used phone number (not one from the invoice) to confirm the account change. If they confirm, the probability collapses toward zero and the shipment proceeds; if they deny, it is near-certain fraud. The 40 prior clean invoices are already reflected in the base rate and in the supplier's track record; they justify not assuming guilt but do not lower the specific signal's force much.",
    keyInsights: [
      "With a 1-in-500 base rate, even a good screen produces mostly false positives; the flag alone gives about 4 percent.",
      "The changed account is the stronger signal (likelihood ratio about 20) and moves the belief to roughly even odds.",
      "The right action at even odds is a cheap, decisive verification, not a blanket freeze and not ignoring the flag.",
      "Stating the independence assumption and a range, not a point, is part of a calibrated answer.",
    ],
    commonErrors: [
      "Reading '90 percent sensitivity' as '90 percent chance the flag is right'.",
      "Ignoring the base rate entirely.",
      "Treating the 40 clean invoices as a separate strong signal that cancels the account change.",
      "Jumping to freeze all payments, or to ignore the flag, without a verification step.",
      "Giving a precise number without noting the independence assumption.",
    ],
    rubric: [
      {
        id: "base_rate",
        title: "Base rate first",
        description: "Derives the post-flag probability from the base rate and the screen's rates (about 4 percent).",
        weight: 3,
        skill: "calibration",
        levels: [
          { score: 0, descriptor: "Ignores the base rate" },
          { score: 0.5, descriptor: "Mentions it but the estimate is far off" },
          { score: 1, descriptor: "Correct order of magnitude with working shown" },
        ],
      },
      {
        id: "update",
        title: "Updating on the second signal",
        description: "Uses the account-change likelihoods to update to roughly 40–55 percent and states the independence assumption.",
        weight: 3,
        skill: "evidence_evaluation",
        levels: [
          { score: 0, descriptor: "No update, or update in the wrong direction" },
          { score: 0.5, descriptor: "Right direction, magnitude unjustified" },
          { score: 1, descriptor: "Roughly correct magnitude with the assumption stated" },
        ],
      },
      {
        id: "action",
        title: "Decision fits the belief",
        description: "Chooses a cheap verification that resolves the uncertainty, and states what each outcome implies.",
        weight: 2,
        skill: "decision_quality",
        levels: [
          { score: 0, descriptor: "Freeze everything or ignore the flag" },
          { score: 0.5, descriptor: "Verification proposed without interpreting outcomes" },
          { score: 1, descriptor: "Cheap verification via a trusted channel, outcomes interpreted" },
        ],
      },
    ],
    hints: [
      "The question is how likely fraud is given the flag, which is not the same as how often the screen catches fraud. Start from how common fraud is at all.",
      "Try natural frequencies: imagine 10,000 invoices. How many are fraudulent? How many of those get flagged? How many legitimate ones get flagged anyway?",
      "For the second signal, compare how often a changed account appears in fraud (60 percent) with how often it appears in legitimate invoices (3 percent). That ratio is how much the signal should move you.",
      "Convert to odds: odds after the flag, times the ratio for the account change, gives the new odds. Then turn odds back into a probability and say what assumption you made.",
      "Worked solution: 10,000 invoices → 20 fraudulent, 9,980 legitimate; flagged: 18 fraudulent, about 399 legitimate → about 4 percent. Account change ratio 0.60/0.03 = 20; odds 18:399 × 20 ≈ 0.9:1 → about 47 percent, assuming independence. At even odds, verify the account change with the supplier through a previously used contact before paying; do not freeze everything.",
    ],
    debrief:
      "Two habits separate calibrated reasoning from intuition here. First, the base rate: a rare event stays fairly unlikely after one moderately good signal, which is why most alerts in fraud, medicine and security are false positives. Second, updating by likelihood ratios: the changed bank account is worth about twenty times more than the flag, and multiplying odds makes that explicit instead of vaguely 'feeling more suspicious'. The best answers also treated the number as a range and named the independence assumption, because the two signals are probably not fully independent (a tool may weight account changes internally). And they matched the action to the belief: at roughly even odds the value of a cheap phone call is enormous, whereas freezing all payments punishes a probably-innocent supplier and ignoring the flag risks a real loss.",
    coachNotes:
      "If the user says 90 percent early, ask what fraction of all invoices are fraudulent and whether that matters. Push for natural frequencies rather than formulas if they struggle. In the revision phase ask what a changed bank account does to the number and why. Reward a range and a stated assumption over false precision.",
  },
};
