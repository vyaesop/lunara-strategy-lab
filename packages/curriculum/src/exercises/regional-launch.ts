import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-25T00:00:00.000Z";

/**
 * Strategic planning, open rubric. Trains sequencing under constraints,
 * anticipating a competitor, and choosing what to learn before committing.
 */
export const regionalLaunch: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-regional-launch",
    slug: "regional-launch",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Regional Launch",
    summary:
      "A small logistics software company has runway for one regional launch. Decide where, in what sequence, and what you must learn before committing.",
    mode: "strategic_planning",
    difficulty: 3,
    answerKind: "open",
    estimatedMinutes: 25,
    learningObjectives: [
      "Translate a vague objective into a decision with explicit success criteria",
      "Sequence actions so that cheap information is gathered before expensive commitments",
      "Anticipate a competitor's most likely response and prepare a contingency",
    ],
    scenario:
      "You lead a twelve-person company selling route-planning software to mid-sized delivery fleets. You have cash for roughly five months of operation and a board that expects a credible growth story within four. Two regions are open: the North, where you have three paying pilots and a strong reference customer, but where an established competitor, Meridian, dominates and prices aggressively; and the South, where there is no incumbent, fleets are more fragmented, your product needs a local-language interface and a regulatory data-residency feature you have not built, and you have no customers yet. You can afford to staff one launch properly. Your task is to produce a plan: the region, the sequence of moves over the next four months, what you would find out before spending heavily, what Meridian is likely to do, and what you will do if your plan's key assumption turns out to be wrong.",
    facts: [
      "Cash covers about five months at the current burn rate; a launch raises burn by roughly 40 percent for its duration.",
      "North: three paying pilots, one willing reference customer, forty target fleets, Meridian holds an estimated 60 percent of them and has cut prices twice in the last year.",
      "South: no incumbent, around ninety small fleets, local-language interface and data-residency feature estimated at ten to twelve engineer-weeks, no sales presence.",
      "Sales cycles have averaged eight weeks in the North; there is no South data.",
      "The board's four-month milestone is 'credible growth evidence', not a specific revenue number.",
    ],
    constraints: [
      "You can staff one launch; splitting the team is allowed but counts against the plan's credibility unless justified.",
      "Any spending plan that exceeds the cash available is invalid.",
      "You may not assume information you do not have; if you need it, state how you would get it and what it costs.",
    ],
    expectedDimensions: ["planning", "strategic_foresight", "information_gathering", "risk_assessment"],
    tags: ["strategy", "market-entry", "competition"],
  },
  hidden: {
    exerciseId: "ex-regional-launch",
    version: 1,
    solution:
      "There is no single correct region; the reference analysis judges the plan's structure. A strong plan (either region) does the following. It defines what 'credible growth evidence' means for the board in measurable terms before choosing. It front-loads cheap information: for the North, a pricing test with the three pilots and a conversation with the reference customer about why they chose you over Meridian; for the South, five to ten discovery calls with fleet operators before committing engineering weeks, and a check of the regulatory requirement with a local advisor. It sequences commitments so that the expensive step (a full sales push or the ten-week feature build) happens only after the cheap step has confirmed the key assumption. It names Meridian's most likely response to a North push (a further price cut or bundling with an existing product) and a South entry (probably slower, but possibly a partnership with a local reseller) and prepares a specific counter. It states the plan's single most load-bearing assumption and a trigger and date for abandoning or switching. It stays within cash: roughly four months of launch burn is affordable only with a decision point no later than month two.",
    keyInsights: [
      "Define the success criterion before choosing the region; the board milestone is deliberately vague.",
      "Buy information before buying commitment: discovery calls and pilot pricing tests cost days, the feature build costs weeks.",
      "Meridian's response is predictable and should be planned for rather than hoped away.",
      "A plan needs a named kill or switch trigger with a date, because cash makes the timeline unforgiving.",
    ],
    commonErrors: [
      "Choosing the South because 'no competition' without noticing the ten-week feature and no sales presence consume most of the runway.",
      "Choosing the North without a specific answer to a further Meridian price cut.",
      "Skipping information gathering and committing the full team in month one.",
      "Producing a plan whose spend exceeds cash.",
      "No stated assumption, no trigger, no fallback.",
    ],
    rubric: [
      {
        id: "criteria",
        title: "Explicit success criteria",
        description: "States what the board must see at four months and why that counts as credible.",
        weight: 1,
        skill: "planning",
        levels: [
          { score: 0, descriptor: "No criteria" },
          { score: 0.5, descriptor: "Vague criteria" },
          { score: 1, descriptor: "Measurable criteria tied to the board's stated need" },
        ],
      },
      {
        id: "sequencing",
        title: "Information before commitment",
        description: "Cheap learning steps precede expensive commitments, with a decision point.",
        weight: 3,
        skill: "information_gathering",
        levels: [
          { score: 0, descriptor: "Commits immediately" },
          { score: 0.5, descriptor: "Some learning steps but no decision point" },
          { score: 1, descriptor: "Named learning steps, what they cost, and a dated decision point" },
        ],
      },
      {
        id: "competitor",
        title: "Anticipated competitor response",
        description: "Predicts Meridian's most likely move and prepares a specific counter.",
        weight: 2,
        skill: "strategic_foresight",
        levels: [
          { score: 0, descriptor: "Competitor ignored" },
          { score: 0.5, descriptor: "Response named, no counter" },
          { score: 1, descriptor: "Response named with a concrete counter" },
        ],
      },
      {
        id: "risk",
        title: "Assumption and fallback",
        description: "Identifies the load-bearing assumption, a trigger for abandoning it, and a fallback within cash.",
        weight: 2,
        skill: "risk_assessment",
        levels: [
          { score: 0, descriptor: "No assumption or fallback" },
          { score: 0.5, descriptor: "Assumption named without a trigger" },
          { score: 1, descriptor: "Assumption, trigger date and affordable fallback" },
        ],
      },
    ],
    hints: [
      "Start by asking what the board would accept as 'credible growth evidence'. Write it down as something you could show them.",
      "List what you do not know for each region. Which of those unknowns could be resolved in days rather than weeks, and how?",
      "Look at the constraint on cash and the ten-to-twelve engineer-week feature. How many months of runway does the South's prerequisite consume before any selling can start?",
      "Use a simple frame: cheap tests first, expensive commitments second, a dated decision point between them, and a named response to what Meridian does next.",
      "Worked plan shape: weeks 1–3 run discovery (pilot pricing test in the North or ten operator calls in the South, plus a regulatory check); week 4 decide against a pre-written criterion; months 2–4 execute the chosen launch; hold a switch trigger at the end of month two; define Meridian's likely counter and your response; show the spend stays within five months of cash.",
    ],
    debrief:
      "Plans fail here in one of two ways: they pick a region on instinct and spend the runway proving the instinct, or they gather information forever and never commit. The structure that survives is a short, cheap learning phase with a written decision criterion, then a full commitment with a switch trigger. Note that the South's 'no competition' is partly an illusion: the absence of an incumbent is a signal that either the market is unproven or the prerequisites are costly, and the ten-week build plus no sales presence turns five months of cash into a very thin margin. The North's problem is the opposite: the market is proven, and so is the competitor. Whichever region you chose, a strong answer named Meridian's likely price cut and had something specific to say back, such as competing on a feature Meridian bundles poorly, or on service to the mid-sized fleets Meridian under-serves. Finally, the best plans stated the one assumption everything rested on and the date by which they would know if it was wrong.",
    coachNotes:
      "Do not evaluate the region choice. Ask for the success criterion first. If the user commits before learning, ask what they would need to know to be confident, and what it would cost to find out. Push for Meridian's response by asking 'what does Meridian do in week two of your plan?'. Ask for the kill trigger explicitly in the revision phase.",
  },
};
