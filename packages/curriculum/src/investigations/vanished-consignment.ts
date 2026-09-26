import type { InvestigationDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/**
 * Fictional case with an answer key. Trains strategic anticipation and
 * evidence evaluation around an insider: the answer is the logistics
 * coordinator, while the obvious suspect (the driver) is a decoy.
 */
export const vanishedConsignment: InvestigationDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "inv-vanished-consignment",
    slug: "vanished-consignment",
    version: 1,
    status: "published",
    kind: "fictional",
    title: "The Vanished Consignment",
    summary: "A pallet of high-value network equipment left the depot and never reached the customer. The driver is the obvious suspect. Work out who could have known enough to make it disappear, and what would prove it.",
    difficulty: 4,
    estimatedMinutes: 35,
    learningObjectives: [
      "Reason about who had the information and access required, not only who had the opportunity",
      "Anticipate what a knowledgeable insider would do to deflect suspicion",
      "Choose actions that test the insider hypothesis rather than the convenient one",
    ],
    briefing:
      "Northgate Distribution moves electronics for several manufacturers. On Thursday a pallet of switches worth about 140,000 was dispatched to a data-centre customer. The driver, Sam Ilori, delivered three other stops and reported the pallet missing at the fourth. The customer never received it. The depot manager wants Sam suspended. You are the loss investigator. You have 12 points. Determine what most likely happened to the consignment and who was involved, and say what would confirm it.",
    knownFacts: [
      "Consignments are booked into the routing system by the logistics coordinator, who assigns loads to drivers the evening before.",
      "High-value loads are supposed to be flagged in the routing system so that they are loaded last and delivered first.",
      "Sam Ilori has driven for Northgate for six years with no prior incidents.",
    ],
    entities: [
      { id: "ent-sam", name: "Sam Ilori", role: "Driver", description: "Drove the route; reported the loss at stop four.", candidate: true },
      { id: "ent-lena", name: "Lena Voss", role: "Logistics coordinator", description: "Books consignments and assigns routes; the only person who edits the high-value flag.", candidate: true },
      { id: "ent-loaders", name: "Night loading crew", role: "Warehouse", description: "Three agency staff who loaded the trailer.", candidate: true },
      { id: "ent-external", name: "External theft", role: "Explanation", description: "Theft by outsiders without insider help.", candidate: true },
      { id: "ent-undetermined", name: "Undetermined", role: "Explanation", description: "The evidence does not support a conclusion.", candidate: true },
      { id: "ent-manager", name: "Ruth Adeyemi", role: "Depot manager", description: "Wants a quick resolution; can be interviewed.", candidate: false },
    ],
    actions: [
      { id: "act-sam", label: "Interview Sam Ilori", description: "His account of the route and the discovery.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-lena", label: "Interview Lena Voss", description: "How the load was booked and routed.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-manager", label: "Interview Ruth Adeyemi", description: "Management view and recent changes.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-routing", label: "Pull the routing system audit log", description: "Who created and edited the consignment record and when.", kind: "request_report", cost: 3, requiresEvidence: [] },
      { id: "act-telematics", label: "Pull the vehicle telematics", description: "GPS trace, door-open events and stops for the whole route.", kind: "request_report", cost: 3, requiresEvidence: [] },
      { id: "act-loading", label: "Review loading bay CCTV", description: "Loading of the trailer the night before.", kind: "search", cost: 2, requiresEvidence: [] },
      { id: "act-seal", label: "Inspect the trailer seal and paperwork", description: "Seal numbers on dispatch versus delivery notes.", kind: "inspect", cost: 1, requiresEvidence: [] },
      { id: "act-customer", label: "Call the customer's receiving desk", description: "What they were told about delivery timing.", kind: "interview", cost: 1, requiresEvidence: [] },
      { id: "act-stop3", label: "Visit stop three", description: "Inspect the yard where the pallet was last seen on board.", kind: "observe", cost: 2, requiresEvidence: ["ev-telematics"] },
      { id: "act-lena-comms", label: "Request Lena's work phone and email records", description: "Communications on the days before dispatch (requires authorisation).", kind: "request_report", cost: 4, requiresEvidence: ["ev-routing"] },
    ],
    budget: 12,
    expectedDimensions: ["strategic_foresight", "evidence_evaluation", "information_gathering", "hypothesis_generation"],
    tags: ["investigation", "insider", "anticipation"],
  },
  hidden: {
    investigationId: "inv-vanished-consignment",
    version: 1,
    evidence: [
      { id: "ev-incident", title: "Incident report", content: "Sam reported the pallet missing at stop four (the customer) at 14:20. Delivery notes for stops one to three signed. Sam says the trailer was sealed at the depot and he did not break the seal until stop one.", source: "Depot", kind: "document", reliability: "medium", initial: true },
      { id: "ev-manager-note", title: "Depot manager's note", content: "'Sam is the only person who had the goods. I want him off the road today.' Adds that agency loaders 'change every week'.", source: "Ruth Adeyemi", kind: "testimony", reliability: "low", initial: true },
      { id: "ev-sam", title: "Interview: Sam Ilori", content: "Says the route order was unusual: the high-value stop was placed last instead of first, which he queried with Lena by message the evening before and was told 'system says so'. Says at stop three the yard was busy and he left the trailer doors open for about ten minutes while a forklift unloaded another pallet. Cooperative; offers his phone.", source: "Sam Ilori", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-lena", title: "Interview: Lena Voss", content: "Says the consignment was booked normally and the system 'must have' dropped the high-value flag. Says she did not notice Sam's message until the morning. Volunteers that Sam 'has money trouble' but cannot say how she knows.", source: "Lena Voss", kind: "testimony", reliability: "low", initial: false },
      { id: "ev-manager", title: "Interview: Ruth Adeyemi", content: "Confirms Lena is the only user who can edit the high-value flag and route order. Mentions Lena asked two weeks ago which customers take high-value loads, 'for capacity planning'.", source: "Ruth Adeyemi", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-routing", title: "Routing system audit log", content: "Consignment created 16:02 Wednesday by L.Voss with high-value flag ON and delivery position 1. At 21:47 Wednesday the record was edited by L.Voss: flag OFF, delivery position 4. No system fault entries. Sam's query message logged at 22:10, read at 22:12.", source: "Routing system", kind: "document", reliability: "high", initial: false },
      { id: "ev-telematics", title: "Vehicle telematics", content: "Trailer door-open events: depot 06:40 (loading check), stop one 09:05, stop two 10:30, stop three 12:15 to 12:27, stop four 14:12. The vehicle made no unscheduled stops. At stop three the trailer was open for twelve minutes in a shared yard.", source: "Telematics provider", kind: "report", reliability: "high", initial: false },
      { id: "ev-loading", title: "Loading bay CCTV", content: "The pallet was loaded last, at the tail of the trailer, at 23:50 by the agency crew following the printed load sheet. Seal applied 00:05. Nothing irregular in the crew's behaviour.", source: "Depot CCTV", kind: "document", reliability: "high", initial: false },
      { id: "ev-seal", title: "Seal and paperwork", content: "Seal number on the dispatch sheet matches the seal Sam broke at stop one. The load sheet printed at 22:30 Wednesday shows the pallet at position 4 (tail), consistent with the edited routing record.", source: "Depot paperwork", kind: "document", reliability: "high", initial: false },
      { id: "ev-customer", title: "Customer receiving desk", content: "Received a call on Wednesday evening from 'Northgate logistics' saying the delivery would arrive late afternoon Thursday rather than first thing. The caller was a woman; no name taken.", source: "Customer", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-stop3", title: "Stop three yard", content: "Shared yard used by four businesses; a white van with no livery was seen by a yard worker reversing up to Northgate's trailer at about 12:20 while the forklift was busy. No CCTV in the yard.", source: "Yard worker", kind: "testimony", reliability: "medium", initial: false },
      { id: "ev-lena-comms", title: "Lena's work communications", content: "Wednesday 21:30: outgoing call to an unlisted mobile, four minutes. 21:50: message to the same number: 'pos 4, stop 3 around 12'. Thursday 12:31: incoming message from the same number: 'done'.", source: "Company phone records", kind: "document", reliability: "high", initial: false },
    ],
    actionReveals: {
      "act-sam": ["ev-sam"],
      "act-lena": ["ev-lena"],
      "act-manager": ["ev-manager"],
      "act-routing": ["ev-routing"],
      "act-telematics": ["ev-telematics"],
      "act-loading": ["ev-loading"],
      "act-seal": ["ev-seal"],
      "act-customer": ["ev-customer"],
      "act-stop3": ["ev-stop3"],
      "act-lena-comms": ["ev-lena-comms"],
    },
    groundTruth: {
      answerEntityId: "ent-lena",
      summary:
        "Lena Voss arranged the theft. She edited the consignment on Wednesday evening to remove the high-value flag and move the delivery to the last position, which put the pallet at the tail of the trailer and guaranteed it would be on board, and accessible, during the busy shared yard at stop three. She told the customer the delivery would be late so no one would chase it in the morning, and she messaged an accomplice with the position and the window; a white van collected the pallet while the trailer was open. Sam's open doors at stop three were normal practice and the twelve-minute window was created by the routing change, not by him. The loading crew followed the printed sheet. Remaining uncertainty: the identity of the accomplice and whether anyone else at the depot knew.",
      keyEvidenceIds: ["ev-routing", "ev-telematics", "ev-lena-comms", "ev-customer"],
      misleadingEvidenceIds: ["ev-manager-note", "ev-lena"],
    },
    rubric: [
      { id: "access", title: "Information and access", description: "Reasoned about who could know the load's value, route and timing, not only who touched the goods, and tested it with the right records.", weight: 3, skill: "information_gathering", levels: [{ score: 0, descriptor: "Opportunity only" }, { score: 0.5, descriptor: "Insider considered but not tested" }, { score: 1, descriptor: "Insider knowledge identified and tested with the audit log" }] },
      { id: "anticipation", title: "Anticipating deflection", description: "Recognised that a knowledgeable insider would arrange circumstances that point at the driver.", weight: 2, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "Took the framing at face value" }, { score: 1, descriptor: "Explicitly asked who benefits from Sam looking guilty" }] },
      { id: "sources", title: "Source reliability", description: "Weighted the manager's note and Lena's unsupported claim about Sam as weak; system logs and telematics as strong.", weight: 3, skill: "evidence_evaluation", levels: [{ score: 0, descriptor: "Testimony treated as fact" }, { score: 0.5, descriptor: "Some weighting" }, { score: 1, descriptor: "Consistent weighting with reasons" }] },
      { id: "hypotheses", title: "Competing hypotheses", description: "Kept driver, coordinator, loaders and external theft as live explanations with evidence links.", weight: 2, skill: "hypothesis_generation", levels: [{ score: 0, descriptor: "One" }, { score: 0.5, descriptor: "Two" }, { score: 1, descriptor: "Three or more with links" }] },
    ],
    hints: [
      "Ask not only who could have taken the pallet, but who knew it was valuable, where it would be, and when.",
      "Sam says the route order was unusual. Who controls route order, and is there a record of changes?",
      "If an insider planned this, what would they do to make someone else look responsible? Check whether the evidence against the obvious suspect was manufactured by circumstances someone else controlled.",
      "The audit log opens a further action. Records of who Lena contacted the evening before are the test that separates 'system error' from intent.",
      "Worked reasoning: the audit log shows Lena removed the flag and moved the stop to last at 21:47, after which the load sheet placed the pallet at the tail; telematics show a twelve-minute open trailer at a shared yard; the customer was told to expect a late delivery by a woman from Northgate; Lena's phone records show 'pos 4, stop 3 around 12' sent to an unlisted number and 'done' received at 12:31. Sam's behaviour was normal practice. The accomplice remains unidentified.",
    ],
    debrief:
      "This case punishes taking the frame you are handed. The depot manager, the timing, and the open trailer doors all point at Sam, and the cheapest actions confirm that picture. The decisive move was to ask who had the information, not who had the goods: only one person could change the value flag and the route order, and the audit log shows her doing exactly that hours before dispatch. From there, anticipating an insider's behaviour tells you what to look for: a manufactured window at stop three, a call to the customer so no one would chase the delivery, and contact with an outside party. Investigators who spent their budget on the loading crew and the seal found nothing wrong, because nothing was wrong there. The general lesson: when a story is convenient for everyone except the person it blames, test the story's author before you test the suspect.",
    coachNotes: "If the learner focuses on Sam, ask who decided the route order and whether that decision could be checked. If they reach the audit log, ask what a coordinator planning a theft would do next, and whether any action can test that.",
  },
};
