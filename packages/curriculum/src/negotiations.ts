import { NegotiationDefinition, type NegotiationPublic } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

export const bridgeRenewal: NegotiationDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "neg-bridge-renewal",
    slug: "bridge-renewal",
    version: 1,
    status: "published",
    title: "Renewing the Bridge Contract",
    summary: "Negotiate the renewal with the authority's procurement lead, who says your price is 20 percent too high and has a rival bid.",
    difficulty: 3,
    estimatedMinutes: 25,
    learningObjectives: ["Open on interests rather than price", "Trade cheap concessions for valuable ones", "Hold a walk-away derived from your own economics"],
    briefing:
      "You run a bridge-maintenance firm; the three-year contract with the regional authority is up for renewal. Your renewal price is 1.2 million per year; direct cost is about 0.95 million and below 1.0 million the contract is not worth your management time. The competing bidder is national, at 1.0 million, with a four-month mobilisation; two statutory inspections fall due in six weeks. Your crews are idle for two months each winter. An app for reporting defects would cost you about 60,000 to build. The procurement lead is measured on year-one savings; the engineering director, not in the room, cares about compliance and response times.",
    userRole: "You are the vendor's managing director.",
    counterpart: { name: "Dana Whitfield", role: "Procurement lead, regional authority", publicDescription: "Measured on year-one savings. Has written that your price is 20 percent too high and that there is a competing bid. Not the final decision-maker on compliance matters." },
    issues: [
      { key: "price", label: "Annual price", unit: "k", min: 950, max: 1250, step: 5, userPrefersHigh: true },
      { key: "term", label: "Term", unit: "years", min: 1, max: 3, step: 1, userPrefersHigh: true },
      { key: "winter", label: "Winter preventive programme included", unit: "", min: 0, max: 1, step: 1, userPrefersHigh: false },
      { key: "app", label: "Defect-reporting app included", unit: "", min: 0, max: 1, step: 1, userPrefersHigh: false },
    ],
    userGuidance: "Anything averaging below 1,050k over the term barely covers risk and management attention; a one-year deal at 1,000k is only a bridge. Winter work and the app cost you little.",
    maxRounds: 8,
    expectedDimensions: ["negotiation", "strategic_foresight", "planning"],
    tags: ["negotiation", "contract"],
  },
  hidden: {
    negotiationId: "neg-bridge-renewal",
    version: 1,
    persona:
      "You are Dana Whitfield, procurement lead. Your bonus depends on visible year-one savings; a 10 percent headline cut would satisfy your director. You know the rival bidder cannot mobilise for four months and that two inspections are due in six weeks, and you are privately worried about that, but you will not volunteer it. You value the winter preventive programme (it reduces emergency call-outs that embarrass the authority) and the defect app (the engineering director asked for it). You prefer a longer term because retendering is costly for you, but you frame it as a concession. You are courteous, brisk, and you anchor hard on price early. You never reveal your reservation values. You do not decide acceptance yourself: the system tells you whether the proposal is accepted, countered or rejected, and you voice that decision in character with one or two sentences of reasoning that fit your incentives.",
    weights: { price: 0.55, term: 0.15, winter: 0.18, app: 0.12 },
    counterpartPrefersHigh: { price: false, term: true, winter: true, app: true },
    acceptThreshold: 0.62,
    patienceDecay: 0.025,
    floor: 0.5,
    opening: { price: 1000, term: 3, winter: 1, app: 1 },
    referenceDeal: { price: 1120, term: 3, winter: 1, app: 1 },
    rubric: [
      { id: "interests", title: "Interests first", description: "Explored what the procurement lead needs (headline saving, compliance risk) before trading numbers.", weight: 3, skill: "negotiation", levels: [{ score: 0, descriptor: "Went straight to price" }, { score: 0.5, descriptor: "Asked some questions" }, { score: 1, descriptor: "Surfaced the saving metric and the inspection risk as shared problems" }] },
      { id: "trades", title: "Concession trading", description: "Offered winter work and the app in exchange for price or term rather than giving them away or ignoring them.", weight: 3, skill: "planning", levels: [{ score: 0, descriptor: "Price-only concessions" }, { score: 0.5, descriptor: "Non-price items offered without a trade" }, { score: 1, descriptor: "Each concession traded for something" }] },
      { id: "leverage", title: "Time-limited leverage", description: "Used the mobilisation gap and inspection deadline without threatening.", weight: 2, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "Unused" }, { score: 0.5, descriptor: "Used as a threat" }, { score: 1, descriptor: "Raised as a shared problem" }] },
      { id: "walkaway", title: "Walk-away discipline", description: "Did not accept a deal below the user's own guidance.", weight: 2, skill: "negotiation", levels: [{ score: 0, descriptor: "Accepted below guidance" }, { score: 1, descriptor: "Held or walked" }] },
    ],
    debrief:
      "Dana's incentives were narrow: a visible year-one saving. That made a back-loaded price structure the natural trade, and it made the winter programme and the app valuable to her at low cost to you. The strongest sessions asked early what she was measured on, raised the six-week inspections as a joint problem rather than a threat, and gave concessions one at a time in exchange for term or price. Sessions that opened with a price defence tended to end near 1,050k with nothing traded, or with a one-year deal that just reopens the fight next spring.",
  },
};

export const salaryOffer: NegotiationDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "neg-salary-offer",
    slug: "salary-offer",
    version: 1,
    status: "published",
    title: "The Offer",
    summary: "You have an offer from a company you like. The recruiter's number is below your target. Negotiate salary, start date and remote days without losing the offer.",
    difficulty: 2,
    estimatedMinutes: 15,
    learningObjectives: ["Anchor with a justified number", "Trade across issues instead of haggling on one", "Recognise a good deal and close"],
    briefing:
      "You have a written offer: 92k salary, start in 4 weeks, 1 remote day a week. Your research puts the market band at 95–110k for the role. Your current job pays 90k with 2 remote days. You would like a later start (6–8 weeks) to finish a project, which the recruiter has not been told. You have no other live offer.",
    userRole: "You are the candidate.",
    counterpart: { name: "Priya Nair", role: "Recruiter", publicDescription: "Friendly, moving fast to close before the quarter ends. Says the band is 'tight'." },
    issues: [
      { key: "salary", label: "Salary", unit: "k", min: 88, max: 112, step: 1, userPrefersHigh: true },
      { key: "start_weeks", label: "Start in", unit: "weeks", min: 2, max: 10, step: 1, userPrefersHigh: true },
      { key: "remote_days", label: "Remote days per week", unit: "days", min: 0, max: 4, step: 1, userPrefersHigh: true },
    ],
    userGuidance: "Below 95k you are better off staying put unless remote days improve; do not lose the offer over the start date.",
    maxRounds: 6,
    expectedDimensions: ["negotiation", "decision_quality"],
    tags: ["negotiation", "career"],
  },
  hidden: {
    negotiationId: "neg-salary-offer",
    version: 1,
    persona:
      "You are Priya, a recruiter closing before quarter end. The approved band is 92–104k; the hiring manager will go to 104k for a strong candidate but you start low. Start date beyond 8 weeks is a real problem for the manager; 6 weeks is fine. Remote days: two is standard, three needs manager sign-off which you can get. You are warm, brisk, and you say the band is tight. You do not decide acceptance yourself: voice the system's decision in character, with a short reason consistent with your incentives.",
    weights: { salary: 0.6, start_weeks: 0.25, remote_days: 0.15 },
    counterpartPrefersHigh: { salary: false, start_weeks: false, remote_days: false },
    acceptThreshold: 0.6,
    patienceDecay: 0.03,
    floor: 0.45,
    opening: { salary: 92, start_weeks: 4, remote_days: 1 },
    referenceDeal: { salary: 102, start_weeks: 6, remote_days: 2 },
    rubric: [
      { id: "anchor", title: "Justified anchor", description: "Opened with a number grounded in market data rather than a wish.", weight: 2, skill: "negotiation", levels: [{ score: 0, descriptor: "No anchor or accepted the first number" }, { score: 1, descriptor: "Anchored with a reason" }] },
      { id: "package", title: "Package thinking", description: "Traded across salary, start date and remote days instead of haggling on one.", weight: 3, skill: "negotiation", levels: [{ score: 0, descriptor: "Single issue" }, { score: 0.5, descriptor: "Mentioned other issues" }, { score: 1, descriptor: "Explicit trades across issues" }] },
      { id: "close", title: "Knowing when to close", description: "Recognised a good deal and closed without overplaying a weak alternative.", weight: 2, skill: "decision_quality", levels: [{ score: 0, descriptor: "Overplayed or capitulated" }, { score: 1, descriptor: "Closed at or near reference" }] },
    ],
    debrief: "Recruiters open low inside a band and are rewarded for closing quickly; both facts favour a calm, justified counter. The sessions that did best named a market-based number, asked what flexibility existed on start date and remote days, and traded a modest salary concession for the later start they actually needed. Overplaying a non-existent alternative is the classic error; so is accepting the first number because the company is likeable.",
  },
};

export const NEGOTIATIONS: readonly NegotiationDefinition[] = [bridgeRenewal, salaryOffer];

export function listPublishedNegotiations(): NegotiationPublic[] {
  return NEGOTIATIONS.filter((n) => n.public.status === "published").map((n) => n.public);
}

export function findNegotiation(id: string): NegotiationDefinition | null {
  return NEGOTIATIONS.find((n) => n.public.id === id) ?? null;
}

export function validateNegotiations(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const n of NEGOTIATIONS) {
    const r = NegotiationDefinition.safeParse(n);
    if (!r.success) {
      errors.push(`${n.public.id}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const keys = n.public.issues.map((i) => i.key);
    for (const k of keys) {
      if (!(k in n.hidden.weights)) errors.push(`${n.public.id}: no weight for ${k}`);
      if (!(k in n.hidden.opening)) errors.push(`${n.public.id}: no opening for ${k}`);
      if (!(k in n.hidden.referenceDeal)) errors.push(`${n.public.id}: no reference for ${k}`);
    }
    const rubricSkills = new Set(n.hidden.rubric.map((c) => c.skill));
    for (const d of n.public.expectedDimensions) if (!rubricSkills.has(d)) errors.push(`${n.public.id}: expectedDimension ${d} has no rubric criterion`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
