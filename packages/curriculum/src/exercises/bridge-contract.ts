import type { ExerciseDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/** Negotiation preparation, open rubric: interests, alternatives, leverage and a concession plan. */
export const bridgeContract: ExerciseDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "ex-bridge-contract",
    slug: "bridge-contract",
    version: 1,
    status: "published",
    source: "curated",
    title: "The Bridge Contract",
    summary: "Prepare to renegotiate a maintenance contract with a client who says your price is 20 percent too high. Map interests, alternatives and leverage before you decide what to concede.",
    mode: "negotiation",
    difficulty: 3,
    answerKind: "open",
    estimatedMinutes: 25,
    learningObjectives: [
      "Separate stated positions from underlying interests on both sides",
      "Establish both parties' alternatives before setting a walk-away point",
      "Plan concessions that are cheap for you and valuable to them",
    ],
    scenario:
      "You run a firm that maintains pedestrian bridges for a regional authority. The three-year contract is up for renewal. The authority's procurement lead has written that your renewal price is 20 percent above what they will accept and that they have a competing bid. You meet next week. Your task is a negotiation plan: what each side actually needs, what each side would do without a deal, where your leverage really is, what you will ask for, what you are prepared to give and in what order, and the point at which you walk away.",
    facts: [
      "Your renewal price is 1.2 million per year. Your direct cost to deliver is about 0.95 million; below 1.0 million the contract is not worth your management time.",
      "The competing bidder is a national firm with no crews in the region; their bid is 1.0 million but their proposal shows a four-month mobilisation period.",
      "Two of the authority's bridges are due for statutory inspection in six weeks; a lapse would be reported publicly.",
      "The procurement lead is measured on year-one savings; the engineering director, who is not in the meeting, is measured on inspection compliance and has praised your response times.",
      "Your crews are underused for two months each winter; extra work then costs you little.",
      "The authority has said informally that it would like an app for reporting bridge defects, which you could build for about 60,000 one-off.",
    ],
    constraints: [
      "Do not invent facts about the competitor beyond what is given; if you need to know something, plan how to find out.",
      "Your plan must state a walk-away point and the reasoning behind it.",
    ],
    expectedDimensions: ["negotiation", "strategic_foresight", "planning"],
    tags: ["negotiation", "interests", "batna"],
  },
  hidden: {
    exerciseId: "ex-bridge-contract",
    version: 1,
    solution:
      "Reference analysis. Positions: they want a 20 percent cut; you want 1.2 million. Interests: the procurement lead needs a visible year-one saving; the authority as a whole needs uninterrupted inspection compliance and fast defect response; you need margin, predictable revenue and useful work for idle winter crews. Alternatives: yours is losing the contract and idling crews, painful but survivable above 1.0 million elsewhere; theirs is a cheaper bidder who cannot mobilise for four months while two inspections fall due in six weeks, which is a serious compliance and reputational risk. That asymmetry is your leverage, and it is time-limited: it weakens once the competitor has mobilised. Plan: open by establishing interests, not price; make the inspection deadline and the mobilisation gap explicit without threatening; propose a package that gives the procurement lead a headline year-one saving while protecting your margin: for example, year-one price 1.08 million (a visible 10 percent reduction) with years two and three at 1.15 million indexed, a winter preventive-maintenance programme included at low marginal cost, and the defect-reporting app offered as a bundled item. Concession order: give winter work first (cheap to you, valuable to them), then the app, then price, in small steps, each traded for term length or scope. Walk-away: below about 1.05 million average across the term, because the margin no longer covers management attention and risk; a one-year deal at 1.0 million is a last-resort bridge only if it keeps the crews busy. Information to gather before the meeting: whether the competitor's bid includes the inspections due in six weeks, and whether the engineering director can be brought into the decision.",
    keyInsights: [
      "The four-month mobilisation gap against a six-week inspection deadline is the real leverage, and it decays.",
      "The procurement lead's interest is a visible year-one saving; a back-loaded price structure satisfies it without giving away the whole margin.",
      "Winter capacity and the app are cheap for you and valuable to them: concede those before price.",
      "A walk-away point must come from your alternative and your cost structure, not from their anchor.",
    ],
    commonErrors: [
      "Negotiating only on price and splitting the difference.",
      "Threatening with the inspection deadline instead of surfacing it as a shared problem.",
      "Conceding price first and cheap items last.",
      "No walk-away point, or one set relative to the competitor's bid rather than your own economics.",
      "Ignoring the absent engineering director as a stakeholder.",
    ],
    rubric: [
      {
        id: "interests",
        title: "Interests behind positions",
        description: "Identifies underlying interests for both sides, including the absent stakeholder.",
        weight: 2,
        skill: "negotiation",
        levels: [
          { score: 0, descriptor: "Positions only" },
          { score: 0.5, descriptor: "Own interests or theirs, not both" },
          { score: 1, descriptor: "Both sides, including the engineering director's compliance interest" },
        ],
      },
      {
        id: "alternatives",
        title: "Alternatives and leverage",
        description: "Establishes both parties' no-deal alternatives and locates the time-limited leverage in the mobilisation gap.",
        weight: 3,
        skill: "strategic_foresight",
        levels: [
          { score: 0, descriptor: "No alternatives considered" },
          { score: 0.5, descriptor: "Own alternative only, or leverage misidentified" },
          { score: 1, descriptor: "Both alternatives, leverage and its expiry named" },
        ],
      },
      {
        id: "concessions",
        title: "Concession plan",
        description: "Orders concessions from cheap-to-give to costly, each traded for something.",
        weight: 2,
        skill: "planning",
        levels: [
          { score: 0, descriptor: "Price cut only" },
          { score: 0.5, descriptor: "Some non-price items, no order or trades" },
          { score: 1, descriptor: "Ordered package with explicit trades" },
        ],
      },
      {
        id: "walkaway",
        title: "Walk-away point",
        description: "States a walk-away with reasoning from own costs and alternative.",
        weight: 1,
        skill: "negotiation",
        levels: [
          { score: 0, descriptor: "None" },
          { score: 1, descriptor: "Stated and justified" },
        ],
      },
    ],
    hints: [
      "Before deciding what to concede, write down what each side needs. 'A 20 percent cut' is a position; what does the procurement lead actually get measured on?",
      "List what happens to each side if there is no deal. Read the competitor's proposal again for anything that affects their ability to deliver soon.",
      "Two facts are about timing: a four-month mobilisation and inspections due in six weeks. What does that combination mean, and for how long?",
      "Structure the offer so the other side's headline number improves while your average does not fall as far: think about year-one versus later years, and about items that cost you little.",
      "Worked plan: interests (visible year-one saving vs. compliance and response time; your margin and winter utilisation); alternatives (their competitor cannot cover the inspections in six weeks; you can absorb a loss above 1.0 million); package (year one 1.08, later years 1.15 indexed, winter preventive work and the app bundled); concession order (winter work, app, then price in small steps for term); walk-away about 1.05 average, one-year 1.0 only as a bridge; before the meeting, learn whether their bid covers the six-week inspections and whether the engineering director can join.",
    ],
    debrief:
      "Most first drafts negotiate the number the other side put on the table. The strong drafts refused that frame and asked what each side needs, which immediately exposed the mismatch between a procurement lead measured on year-one savings and an authority that cannot afford a lapse in inspections. From there the plan writes itself: give the headline saving early in the term, protect the average, and pay for it with things that cost you little. The leverage in this case is real but perishable; the best plans noticed that every week the competitor spends mobilising erodes it, and that raising the inspection risk as a shared problem is far more effective than wielding it as a threat. Finally, a walk-away point is derived from your own alternative and cost structure. Setting it relative to the competitor's bid lets the other side choose your limit for you.",
    coachNotes:
      "If the user proposes a price, ask what interest of the procurement lead it serves and what the engineering director would say. Ask explicitly what happens to the authority if no deal is signed in six weeks. In the revision phase, ask them to order their concessions and to justify the walk-away from their own numbers.",
  },
};
