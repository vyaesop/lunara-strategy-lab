import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/** Abductive reasoning, fixed answer: generate competing explanations and rank them by the evidence. */
export const silentServer: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-silent-server",
    slug: "silent-server",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Silent Server",
    summary: "An order system stopped taking payments at 02:10. Generate the explanations that fit every observation, then rank them and say what single check would separate the top two.",
    mode: "abductive_reasoning",
    difficulty: 3,
    answerKind: "fixed",
    estimatedMinutes: 20,
    learningObjectives: [
      "Generate several distinct explanations before evaluating any of them",
      "Rank explanations by how much of the evidence each one accounts for",
      "Choose the cheapest observation that discriminates between the leading explanations",
    ],
    scenario:
      "You are on call for a small online shop. At 02:10 the payment step began failing for every customer while browsing and adding to cart kept working. You have six observations from the monitoring system and a colleague. Your task is to propose at least three distinct explanations, rank them by fit with the evidence, and name the one check you would run first to separate the top two. You are not asked to fix anything.",
    facts: [
      "From 02:10 every payment attempt fails with a timeout after 30 seconds; before 02:10 the failure rate was under 1 percent.",
      "The payment service's own health check, which only verifies the process is running, reports healthy throughout.",
      "CPU and memory on the payment server are normal; outbound network traffic from it dropped to nearly zero at 02:10.",
      "The card processor's public status page shows no incident.",
      "A scheduled job on the payment server rotates TLS certificates and restarts networking; it last ran at 02:09 according to its log, which ends with 'done'.",
      "A colleague deployed a change to the product catalogue service at 01:40; the catalogue service is unaffected and serving normally.",
    ],
    constraints: [
      "Treat monitoring data and logs as accurate.",
      "Do not assume access to systems beyond what the facts describe; if you would run a check, say what it is and what each result would tell you.",
    ],
    expectedDimensions: ["hypothesis_generation", "evidence_evaluation", "information_gathering"],
    tags: ["abduction", "incident", "diagnosis"],
  },
  hidden: {
    exerciseId: "ex-silent-server",
    version: 1,
    solution:
      "Best-supported explanation: the 02:09 maintenance job broke the payment server's outbound connectivity or its TLS trust (for example a rotated certificate the processor no longer accepts, or networking that came back without an outbound route), so calls to the processor never complete and time out. It fits all six observations: timing matches, the process stays 'healthy' because the health check only tests liveness, CPU and memory are normal because requests are waiting rather than working, outbound traffic collapsed, and the processor is genuinely fine. Competing explanations: (2) a processor-side outage affecting only this merchant, which fits the timeouts but not the collapse of outbound traffic and is unsupported by the status page; (3) the 01:40 catalogue deployment, which is poorly supported: the timing is thirty minutes off and the catalogue service is healthy. A weaker fourth: a firewall or provider change unrelated to the job, which fits the traffic drop but has no positive evidence. The single most discriminating first check: from the payment server, attempt an outbound connection to the processor endpoint (or any external host). Failure isolates the problem to the server's networking or trust store, pointing at the job; success points back toward the processor or a request-specific fault.",
    keyInsights: [
      "The outbound-traffic collapse is the observation that separates a local problem from a remote one.",
      "'Healthy' from a liveness check is nearly no evidence about whether the service works.",
      "Timing coincidence is strong but not decisive; the job's 'done' log means it completed, not that it succeeded harmlessly.",
      "The cheapest discriminating check tests connectivity from the affected machine, not the processor's status page.",
    ],
    commonErrors: [
      "Committing to the 01:40 deployment because it was the most recent change by a person.",
      "Trusting the health check as evidence that the payment service is fine.",
      "Proposing a fix (restart the server) before proposing explanations.",
      "Listing one explanation and treating the exercise as solved.",
      "Choosing an expensive or slow check (calling the processor's support line) over an immediate local one.",
    ],
    rubric: [
      {
        id: "distinct_explanations",
        title: "Distinct explanations",
        description: "Proposes at least three explanations that are genuinely different mechanisms.",
        weight: 2,
        skill: "hypothesis_generation",
        levels: [
          { score: 0, descriptor: "One explanation" },
          { score: 0.5, descriptor: "Two, or three that overlap" },
          { score: 1, descriptor: "Three or more distinct mechanisms" },
        ],
      },
      {
        id: "evidence_fit",
        title: "Ranking by evidence fit",
        description: "Ranks explanations by which observations each accounts for, and uses the outbound-traffic drop.",
        weight: 3,
        skill: "evidence_evaluation",
        levels: [
          { score: 0, descriptor: "No ranking or ranking by gut feel" },
          { score: 0.5, descriptor: "Ranked, but ignores the outbound-traffic observation" },
          { score: 1, descriptor: "Ranked with explicit fit per observation, including outbound traffic" },
        ],
      },
      {
        id: "discriminating_check",
        title: "Discriminating check",
        description: "Names one cheap check whose two outcomes point to different explanations.",
        weight: 2,
        skill: "information_gathering",
        levels: [
          { score: 0, descriptor: "No check, or a fix instead of a check" },
          { score: 0.5, descriptor: "A check that does not separate the top two" },
          { score: 1, descriptor: "A cheap check with both outcomes interpreted" },
        ],
      },
    ],
    hints: [
      "You are asked for explanations and a check, not a fix. List possibilities first; evaluate second.",
      "Sort the observations into two piles: those about the payment server itself and those about the outside world. Which pile changed at 02:10?",
      "One observation is easy to skim past: outbound traffic from the payment server dropped to nearly zero. Which explanations can produce that?",
      "For each explanation, write which of the six observations it explains and which it leaves unexplained. Then ask what single test would have different results under your top two.",
      "Worked reasoning: the 02:09 job touching TLS and networking, followed at 02:10 by timeouts and an outbound-traffic collapse while the process stays alive, fits everything; a processor outage does not explain the traffic collapse and is unsupported by the status page; the 01:40 deployment is thirty minutes early and its service is healthy. First check: try an outbound connection from the payment server to the processor. Failure implicates the server's networking or trust store; success sends you back to the request path or the processor.",
    ],
    debrief:
      "Abduction is inference to the best explanation, and 'best' means accounts for the most evidence with the fewest extra assumptions, not 'most recent thing a human touched'. The trap here is the 01:40 deployment: it is a real change and it is recent, so it feels like a cause, but it fails two tests (timing, and the affected service is a different one). The maintenance job is less visible because it is automated and its log says 'done', yet it is the only candidate that explains the collapse in outbound traffic. Notice also what the healthy status did to your reasoning: a liveness check is evidence that a process exists, not that it works. Finally, the best answers chose a check that is both cheap and decisive, and stated what each outcome would mean before running it. That habit, interpreting the result in advance, is what turns information gathering into hypothesis testing.",
    coachNotes:
      "Do not let the user stop at one explanation; ask for two more that use different mechanisms. If they anchor on the 01:40 deployment, ask which observations it explains and which it does not. If they propose a fix, ask what explanation it presupposes. In the revision phase ask for a check and both interpretations.",
  },
};
