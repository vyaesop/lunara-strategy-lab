import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-25T00:00:00.000Z";

/**
 * Deduction, fixed answer. Trains the difference between what necessarily
 * follows from the premises and what merely seems likely.
 */
export const lockedArchive: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-locked-archive",
    slug: "locked-archive",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Locked Archive",
    summary:
      "A ledger vanished from a badge-controlled archive. Work out what the logs prove, what they merely suggest, and who can be excluded.",
    mode: "deductive_reasoning",
    difficulty: 2,
    answerKind: "fixed",
    estimatedMinutes: 15,
    learningObjectives: [
      "Separate conclusions that necessarily follow from conclusions that are merely plausible",
      "Use exclusion systematically rather than jumping to the most suspicious person",
      "Notice when an identity assumption (badge = owner) is doing hidden work",
    ],
    scenario:
      "A trading firm keeps its master ledger in a small archive room. The room has one door, opened only by badge, and every badge use is logged. On Tuesday evening the ledger disappeared. Four clerks had access that day: Ada, Bram, Cato and Dana. You have the logs and two witness statements below. Your task is not to name the most likely culprit. It is to state exactly what the evidence establishes, what it rules out, and what remains undetermined.",
    facts: [
      "The ledger was confirmed present in the archive at 18:00 by the day manager, and confirmed missing at 20:00 by the night guard.",
      "The badge log for the archive door shows exactly two entries between 18:00 and 20:00: badge C at 18:20 and badge D at 19:10. Each entry admits one person.",
      "Badge C is registered to Cato. Cato reported badge C lost at 17:30. Security found badge C in Bram's desk drawer at 20:30.",
      "Badge D is registered to Dana. The night guard accompanied Dana into the archive at 19:10, states Dana carried nothing out, and states the ledger was already missing at 19:10.",
      "The building gate log shows Ada left the building at 17:45 and did not re-enter that day.",
      "There is no other way into the archive; the walls, ceiling and floor were inspected and intact.",
    ],
    constraints: [
      "Treat the logs and the guard's statement as reliable for this exercise.",
      "Statements by the clerks themselves (including Cato's loss report) are claims, not established facts.",
    ],
    expectedDimensions: ["logical_validity", "evidence_evaluation", "hypothesis_generation"],
    tags: ["logic", "exclusion", "investigation"],
  },
  hidden: {
    exerciseId: "ex-locked-archive",
    version: 1,
    solution:
      "What necessarily follows: the ledger was removed between 18:00 and 19:10, because it was present at 18:00 and already missing when Dana and the guard entered at 19:10. The only entry in that window is badge C at 18:20, and there is no other way in, so the person who entered at 18:20 with badge C removed the ledger. That person was not Ada (she left the building at 17:45 and did not return) and was not Dana (her only entry was at 19:10, after the ledger was gone). The person was therefore Bram or Cato. The evidence does NOT determine which: Cato's loss report is an unverified claim, and the badge being in Bram's desk at 20:30 is consistent with Bram having used it, with Cato having used it and planted it, or with a third explanation. Correct final answer: Ada and Dana are excluded; the ledger left at the 18:20 entry; the remover is Bram or Cato; the evidence cannot decide between them.",
    keyInsights: [
      "The 19:10 guard statement fixes the removal window to 18:00–19:10, which leaves a single door entry.",
      "Badge C identifies the badge, not the person; the lost-badge report breaks the badge-equals-owner assumption.",
      "Exclusion of Ada and Dana is deductively certain; the choice between Bram and Cato is not.",
      "'Found in Bram's desk' raises suspicion but is compatible with more than one story, so it cannot close the case.",
    ],
    commonErrors: [
      "Concluding Bram did it because the badge was in his desk (plausible, not necessary).",
      "Concluding Cato did it because it was his badge (ignores the loss report and the desk finding).",
      "Treating Cato's loss report as an established fact.",
      "Forgetting to use the guard's statement to shrink the time window.",
      "Failing to exclude Dana explicitly, or excluding her for the wrong reason.",
    ],
    rubric: [
      {
        id: "window",
        title: "Time window",
        description: "Uses the 18:00 and 19:10 observations to bound when the ledger was removed.",
        weight: 2,
        skill: "evidence_evaluation",
        levels: [
          { score: 0, descriptor: "Window not established" },
          { score: 0.5, descriptor: "Window stated without justification" },
          { score: 1, descriptor: "Window derived explicitly from both observations" },
        ],
      },
      {
        id: "exclusion",
        title: "Valid exclusions",
        description: "Excludes Ada and Dana with reasons that follow from the facts.",
        weight: 2,
        skill: "logical_validity",
        levels: [
          { score: 0, descriptor: "No valid exclusions" },
          { score: 0.5, descriptor: "One valid exclusion, or both with weak reasons" },
          { score: 1, descriptor: "Both excluded with valid reasons" },
        ],
      },
      {
        id: "undetermined",
        title: "Recognises what is undetermined",
        description: "States that the evidence cannot decide between Bram and Cato and explains why.",
        weight: 3,
        skill: "logical_validity",
        levels: [
          { score: 0, descriptor: "Names a single culprit as proven" },
          { score: 0.5, descriptor: "Hedges without explaining what evidence would be needed" },
          { score: 1, descriptor: "States the undetermined pair and identifies the unverified claims" },
        ],
      },
      {
        id: "alternatives",
        title: "Competing explanations",
        description: "Offers at least two distinct accounts consistent with the evidence.",
        weight: 1,
        skill: "hypothesis_generation",
        levels: [
          { score: 0, descriptor: "One account" },
          { score: 1, descriptor: "Two or more distinct accounts" },
        ],
      },
    ],
    hints: [
      "The objective is not to name a suspect. It is to say what the logs prove, what they exclude, and what they leave open.",
      "Look at the timing evidence first. Two observations bound when the ledger could have left the room.",
      "The guard says the ledger was already missing at 19:10. What does that do to the number of relevant door entries?",
      "Separate the badge from the person. Ask: for each clerk, is there a fact that makes it impossible for them to have been the 18:20 entry?",
      "Worked reasoning: present at 18:00, missing at 19:10, so removed in between. Only one entry in that window (badge C, 18:20), and no other way in, so that person took it. Ada was out of the building; Dana's only entry was later. So Bram or Cato. Cato's loss report is unverified and the badge in Bram's desk fits more than one story, so the evidence cannot choose between them.",
    ],
    debrief:
      "This exercise rewards restraint. Most people feel the pull of the badge in Bram's desk and convert suspicion into a verdict. The logs support a strong claim (the 18:20 entry took the ledger) and two certain exclusions (Ada, Dana), but the final step from 'Bram or Cato' to a single name would require evidence you do not have: for example, camera footage, a witness to the 18:20 entry, or verification of when and how the badge reached Bram's desk. A strong answer states what would distinguish the two remaining accounts. Notice also how one line of the guard's statement did most of the work by shrinking the time window. In investigations, the cheapest high-value move is often to pin down when something happened before asking who.",
    coachNotes:
      "Ask early what the user knows for certain versus assumes. If the user names Bram or Cato as proven, ask what fact rules out the other. Do not confirm exclusions until the user justifies them. If the user has not used the 19:10 statement by the hypothesis phase, ask what the guard's statement implies for the door log.",
  },
};
