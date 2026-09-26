import type { SimulationDefinition } from "@lunara/schemas";

const CREATED = "2026-09-26T00:00:00.000Z";

/**
 * Bismarck after Königgrätz, July–August 1866. Historical background is
 * source-backed and labelled by certainty; the simulation layer (resource
 * numbers, option effects, counterfactual narration) is a teaching device,
 * not a historical claim.
 */
export const bismarck1866: SimulationDefinition = {
  public: {
    schemaVersion: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    id: "sim-bismarck-1866",
    slug: "bismarck-1866",
    version: 1,
    status: "published",
    title: "After Königgrätz: The Peace with Austria",
    figure: "Otto von Bismarck",
    period: "July–August 1866",
    summary: "Prussia has just crushed Austria in the field. The king and the generals want to march on Vienna. Decide what victory is for.",
    difficulty: 4,
    estimatedMinutes: 30,
    learningObjectives: [
      "Distinguish the objective of a war from the momentum of winning it",
      "Weigh third-party reactions (France) as a constraint on how far to push",
      "Trade immediate gains for a future alignment, and justify the trade",
    ],
    background:
      "On 3 July 1866 the Prussian army defeated the Austrian army at Königgrätz (Sadowa) in Bohemia, deciding the Austro-Prussian War in a single battle. Prussia's war aim, as pursued by Minister-President Otto von Bismarck, was to exclude Austria from German affairs and bring the northern German states under Prussian leadership. After the battle, King Wilhelm I and much of the military leadership favoured continuing to Vienna and taking Austrian territory. Bismarck argued for a rapid, moderate peace with Austria that would end the war before France or Russia intervened and would avoid leaving Austria a permanent enemy. Preliminary peace terms were agreed at Nikolsburg on 26 July, and the Treaty of Prague followed on 23 August 1866. Austria withdrew from German affairs and ceded no territory to Prussia; Prussia annexed Hanover, Hesse-Kassel, Nassau, Frankfurt and Schleswig-Holstein and formed the North German Confederation. Prussia also concluded defensive alliances with the south German states. Historians broadly agree on these outcomes; they differ on how much Bismarck's restraint was principle and how much was necessity.",
    role: "You are Bismarck in the days after Königgrätz. You do not command the army and you cannot overrule the king; you can persuade, delay, and threaten to resign. The numbers below are a simulation device, not history.",
    resources: [
      { key: "army_readiness", label: "Army readiness", description: "Ability to keep campaigning. Cholera and supply lines erode it.", initial: 70, min: 0, max: 100, visible: true },
      { key: "king_support", label: "The king's support", description: "How far Wilhelm I will follow your advice.", initial: 45, min: 0, max: 100, visible: true },
      { key: "french_intervention", label: "French intervention risk", description: "Napoleon III is mediating and could demand compensation or intervene. You cannot read it exactly.", initial: 35, min: 0, max: 100, visible: false },
      { key: "austrian_hostility", label: "Austrian hostility", description: "Long-term enmity of Austria toward Prussia.", initial: 60, min: 0, max: 100, visible: true },
      { key: "german_settlement", label: "German settlement", description: "Progress toward Prussian leadership of Germany.", initial: 30, min: 0, max: 100, visible: true },
    ],
    sources: [
      { id: "src-pflanze", title: "Bismarck and the Development of Germany, Volume 1: The Period of Unification, 1815–1871", author: "Otto Pflanze", publication: "Princeton University Press", year: 1990, url: null, locator: null, type: "book", verification: "partially_verified", note: "Standard scholarly account; page references not verified in this build." },
      { id: "src-steinberg", title: "Bismarck: A Life", author: "Jonathan Steinberg", publication: "Oxford University Press", year: 2011, url: null, locator: null, type: "book", verification: "partially_verified", note: "Biography covering the Nikolsburg crisis." },
      { id: "src-craig", title: "Germany 1866–1945", author: "Gordon A. Craig", publication: "Oxford University Press", year: 1978, url: null, locator: null, type: "book", verification: "partially_verified", note: "Context for the 1866 settlement and the North German Confederation." },
      { id: "src-memoirs", title: "Gedanken und Erinnerungen (Reflections and Reminiscences)", author: "Otto von Bismarck", publication: "Cotta", year: 1898, url: null, locator: null, type: "primary_document", verification: "partially_verified", note: "Bismarck's own retrospective account of Nikolsburg; self-serving and written decades later." },
    ],
    claims: [
      { id: "cl-battle", text: "Prussia defeated Austria at Königgrätz on 3 July 1866, effectively deciding the war.", certainty: "established", sourceIds: ["src-pflanze", "src-craig"] },
      { id: "cl-aims", text: "Bismarck's aim was Prussian leadership in northern Germany and the exclusion of Austria from German affairs, not the acquisition of Austrian territory.", certainty: "established", sourceIds: ["src-pflanze", "src-steinberg"] },
      { id: "cl-king", text: "King Wilhelm I and senior generals pressed for a march on Vienna and territorial gains from Austria after the battle; Bismarck opposed this.", certainty: "established", sourceIds: ["src-pflanze", "src-steinberg", "src-memoirs"] },
      { id: "cl-france", text: "Napoleon III offered mediation after Königgrätz, and the possibility of French intervention or demands for compensation weighed on Prussian decisions.", certainty: "established", sourceIds: ["src-pflanze", "src-craig"] },
      { id: "cl-cholera", text: "Cholera and supply problems affected the Prussian army in Bohemia during July 1866, limiting the appeal of a longer campaign.", certainty: "interpretation", sourceIds: ["src-pflanze"] },
      { id: "cl-resign", text: "Bismarck's memoirs describe him threatening resignation and enlisting the Crown Prince to persuade the king to accept moderate terms; the memoirs are a late, partisan source.", certainty: "interpretation", sourceIds: ["src-memoirs", "src-steinberg"] },
      { id: "cl-terms", text: "The Nikolsburg preliminaries (26 July) and the Treaty of Prague (23 August 1866) excluded Austria from Germany, required an indemnity, and ceded no Austrian territory to Prussia; Prussia annexed Hanover, Hesse-Kassel, Nassau, Frankfurt and Schleswig-Holstein.", certainty: "established", sourceIds: ["src-pflanze", "src-craig"] },
      { id: "cl-south", text: "In August 1866 Prussia concluded secret defensive alliances with Bavaria, Württemberg and Baden.", certainty: "established", sourceIds: ["src-pflanze", "src-craig"] },
      { id: "cl-motive", text: "Whether Bismarck's moderation toward Austria was primarily foresight about a future alliance or primarily fear of French intervention is debated among historians.", certainty: "disputed", sourceIds: ["src-pflanze", "src-steinberg"] },
    ],
    expectedDimensions: ["strategic_foresight", "decision_quality", "risk_assessment"],
    tags: ["history", "bismarck", "war-termination"],
  },
  hidden: {
    simulationId: "sim-bismarck-1866",
    version: 1,
    evidence: {
      "ev-french-note": "Reports from Paris: Napoleon III's mediation is conditional; French opinion expects 'compensation' on the Rhine if Prussia grows. (Simulation device consistent with the established claim that French intervention risk weighed on decisions.)",
      "ev-cholera": "Field reports: cholera cases rising in the Prussian camps; supply columns stretched. (Consistent with claim cl-cholera, an interpretation.)",
    },
    turns: [
      {
        id: "t-aims",
        title: "What is victory for?",
        situation:
          "It is the second week of July 1866. The Austrian army is retreating toward Vienna; the road is open. The king is elated and speaks of entering the Austrian capital. Moltke's staff can plan the march. Napoleon III has telegraphed an offer to mediate. You must set the war aim you will argue for in council.",
        intelligence: [
          "Austria is beaten in the field but still has an army covering Vienna and troops returning from Italy.",
          "France has offered mediation. What Napoleon III wants in return is not stated.",
          "Russia has not moved. Britain is not engaged.",
          "The northern German states that sided with Austria (Hanover, Hesse-Kassel, Nassau, Frankfurt) are occupied by Prussian troops.",
        ],
        hidden: ["French intervention risk rises sharply if Prussia demands Austrian territory or marches on Vienna.", "Cholera is spreading in the camps; readiness will fall each week of campaigning."],
        terminal: false,
        options: [
          {
            id: "o-moderate",
            label: "Argue for a quick, moderate peace",
            description: "End the war on the basis of Austria leaving German affairs; no Austrian territory; annex the hostile northern states instead.",
            requires: [],
            effects: [{ resource: "king_support", delta: -15 }, { resource: "french_intervention", delta: -10 }, { resource: "german_settlement", delta: 20 }],
            reveals: ["ev-french-note"],
            historicalMatch: true,
            counterfactualNote: "",
            consequence: {
              narration: "The king is angry: 'the chief culprit escapes unpunished'. The generals mutter. But Paris responds warmly to the prospect of a short war, and the Austrian court signals it will talk if its territory is left intact.",
              effects: [{ resource: "austrian_hostility", delta: -10 }],
              nextTurnId: null,
            },
          },
          {
            id: "o-vienna",
            label: "Back the march on Vienna",
            description: "Support the king and the generals: enter Vienna, demand Austrian Silesia and part of Bohemia, humiliate the Habsburgs.",
            requires: [{ resource: "army_readiness", op: ">=", value: 50 }],
            effects: [{ resource: "king_support", delta: 20 }, { resource: "french_intervention", delta: 35 }, { resource: "army_readiness", delta: -20 }, { resource: "austrian_hostility", delta: 25 }],
            reveals: ["ev-cholera", "ev-french-note"],
            historicalMatch: false,
            counterfactualNote: "COUNTERFACTUAL: Bismarck did not do this. What follows is a plausible simulated consequence, not history.",
            consequence: {
              narration: "The army advances. Within days Paris makes its mediation a demand: an armistice now, and 'compensation' for France if Prussia annexes anything. Cholera empties whole companies. Vienna fortifies. You are winning the war and losing the peace.",
              effects: [{ resource: "german_settlement", delta: -10 }],
              nextTurnId: null,
            },
          },
          {
            id: "o-wait",
            label: "Wait for the French mediation terms",
            description: "Let the army halt short of Vienna and see what Napoleon III proposes before committing to any aim.",
            requires: [],
            effects: [{ resource: "army_readiness", delta: -10 }, { resource: "french_intervention", delta: 10 }],
            reveals: ["ev-cholera"],
            historicalMatch: false,
            counterfactualNote: "COUNTERFACTUAL: Bismarck did not wait for French terms; he moved to shape them. Simulated consequence follows.",
            consequence: {
              narration: "The pause lets Paris frame the settlement. Napoleon's envoy arrives with a scheme that keeps Austria in German affairs and hints at French gains on the Rhine. Every day of waiting, the initiative drifts from Berlin to Paris and the camps sicken.",
              effects: [{ resource: "german_settlement", delta: -5 }],
              nextTurnId: null,
            },
          },
        ],
      },
      {
        id: "t-nikolsburg",
        title: "Nikolsburg: the king digs in",
        situation:
          "Late July, Nikolsburg castle. Preliminary terms are on the table: Austria out of Germany, an indemnity, no Austrian land for Prussia. The king insists on 'something' from Austria and from Saxony, which fought against Prussia. The Austrians say Saxony's integrity is a condition. The Crown Prince is in the castle. You must decide how to handle the king.",
        intelligence: [
          "Austria will sign if it loses no territory and Saxony survives; it will fight on for Saxony.",
          "The Crown Prince is inclined to your view.",
          "The generals want the campaign to continue; the medical reports are grim.",
        ],
        hidden: ["A refusal to compromise on Saxony prolongs the war by weeks and raises French intervention risk further."],
        terminal: false,
        options: [
          {
            id: "o-persuade",
            label: "Persuade the king, with the Crown Prince, and stake your office on it",
            description: "Argue that punishing Austria makes an enemy for a generation and invites France in; enlist the Crown Prince; make clear you cannot serve a policy you believe ruinous.",
            requires: [],
            effects: [{ resource: "king_support", delta: 10 }, { resource: "french_intervention", delta: -10 }, { resource: "austrian_hostility", delta: -10 }, { resource: "german_settlement", delta: 20 }],
            reveals: [],
            historicalMatch: true,
            counterfactualNote: "",
            consequence: {
              narration: "The king yields, writing bitterly that he must 'bite into this sour apple'. The preliminaries are signed on 26 July. Saxony survives as a state within the new Prussian-led order; Austria pays and withdraws.",
              effects: [],
              nextTurnId: null,
            },
          },
          {
            id: "o-yield",
            label: "Yield to the king: demand Austrian Silesia and annex Saxony",
            description: "Give the king what he wants and let the war run on until Austria accepts.",
            requires: [],
            effects: [{ resource: "king_support", delta: 15 }, { resource: "french_intervention", delta: 30 }, { resource: "army_readiness", delta: -20 }, { resource: "austrian_hostility", delta: 25 }],
            reveals: [],
            historicalMatch: false,
            counterfactualNote: "COUNTERFACTUAL: Bismarck did not yield. Simulated consequence follows.",
            consequence: {
              narration: "Austria refuses. The war drags into August with the army sick and Paris increasingly hostile; a French note arrives proposing a congress of the powers to settle Germany's future. The settlement you wanted is now something Europe will decide.",
              effects: [{ resource: "german_settlement", delta: -20 }],
              nextTurnId: null,
            },
          },
          {
            id: "o-split",
            label: "Split the difference: no Austrian land, but annex Saxony",
            description: "Offer the king Saxony as the prize while sparing Austria.",
            requires: [],
            effects: [{ resource: "king_support", delta: 5 }, { resource: "austrian_hostility", delta: 10 }, { resource: "french_intervention", delta: 10 }, { resource: "army_readiness", delta: -10 }],
            reveals: [],
            historicalMatch: false,
            counterfactualNote: "COUNTERFACTUAL: Saxony's survival was an Austrian condition; this is a simulated branch.",
            consequence: {
              narration: "Vienna balks: Saxony was their one firm condition. Talks stall for a fortnight while the camps sicken, until you drop the demand anyway and sign on terms you could have had earlier.",
              effects: [{ resource: "german_settlement", delta: 5 }],
              nextTurnId: null,
            },
          },
        ],
      },
      {
        id: "t-south",
        title: "The south German states",
        situation:
          "August 1866. Bavaria, Württemberg and Baden fought on Austria's side and are now exposed. France expects them to remain outside any Prussian system, as a buffer. You can punish them, ignore them, or bind them.",
        intelligence: [
          "The southern courts fear both Prussian annexation and French domination.",
          "Public opinion in the south is anti-Prussian but also anti-French.",
          "Paris has hinted at wanting territory on the left bank of the Rhine as compensation for Prussia's growth.",
        ],
        hidden: ["Secret defensive alliances tie the south to Prussia in any future war with France without provoking Paris now."],
        terminal: true,
        options: [
          {
            id: "o-alliances",
            label: "Moderate terms plus secret defensive alliances",
            description: "Take modest indemnities, leave the southern states intact, and sign secret treaties committing them to Prussia's side in a defensive war.",
            requires: [],
            effects: [{ resource: "german_settlement", delta: 25 }, { resource: "french_intervention", delta: -5 }],
            reveals: [],
            historicalMatch: true,
            counterfactualNote: "",
            consequence: { narration: "The treaties are signed within weeks. On paper the south stays independent; in substance it is bound to Berlin in the war everyone expects.", effects: [], nextTurnId: null },
          },
          {
            id: "o-punish",
            label: "Annex territory from the south",
            description: "Take land and heavy indemnities from Bavaria and its allies.",
            requires: [],
            effects: [{ resource: "german_settlement", delta: -10 }, { resource: "french_intervention", delta: 30 }],
            reveals: [],
            historicalMatch: false,
            counterfactualNote: "COUNTERFACTUAL: Prussia did not annex southern territory in 1866. Simulated consequence follows.",
            consequence: { narration: "Paris demands compensation on the Rhine and the southern courts look to France for protection. You have unified northern Germany and created a hostile south.", effects: [], nextTurnId: null },
          },
        ],
      },
    ],
    historicalRecord: {
      decision:
        "Bismarck argued for and obtained a moderate peace: Austria left German affairs and paid an indemnity but lost no territory to Prussia; Saxony survived; Prussia annexed the hostile northern states and created the North German Confederation; secret defensive alliances bound the south German states to Prussia.",
      outcome:
        "The war ended within seven weeks of Königgrätz without French or Russian intervention. Austria did not seek revenge in 1870 and became Germany's ally in 1879. Historians debate the balance between foresight and necessity in Bismarck's restraint.",
      sourceIds: ["src-pflanze", "src-craig", "src-steinberg"],
    },
    rubric: [
      { id: "aim", title: "Objective over momentum", description: "Kept the decision anchored to the war's purpose rather than to the opportunity of the moment.", weight: 3, skill: "decision_quality", levels: [{ score: 0, descriptor: "Chased Vienna because it was available" }, { score: 0.5, descriptor: "Named the aim but drifted" }, { score: 1, descriptor: "Every choice justified against the stated aim" }] },
      { id: "third_party", title: "Third-party constraint", description: "Treated French intervention as a live constraint and reasoned about it explicitly, without seeing the number.", weight: 3, skill: "strategic_foresight", levels: [{ score: 0, descriptor: "Ignored France" }, { score: 0.5, descriptor: "Mentioned France without acting on it" }, { score: 1, descriptor: "Anticipated French reaction in each rationale" }] },
      { id: "risk", title: "Campaign risk", description: "Recognised that readiness decays (cholera, supply) and that time favoured a settlement.", weight: 2, skill: "risk_assessment", levels: [{ score: 0, descriptor: "Assumed the army could go on indefinitely" }, { score: 1, descriptor: "Weighed decay against gains" }] },
    ],
    debrief:
      "The trap in this scenario is that winning feels like a reason to keep winning. Every option that pushed further was available, popular with the king, and militarily plausible; it also converted a decided war into an open European question. The historical Bismarck's rationale can be stated without the hindsight that Austria later became an ally: a beaten enemy left intact is a smaller problem than a great power invited to intervene, and a settlement signed in weeks is worth more than one that may never be signed. Notice how much of the decision turned on a variable you could not read exactly: French intervention risk. Good rationales in this scenario reasoned about it anyway, from Napoleon III's incentives, rather than waiting for certainty. Notice, too, what the simulation cannot tell you: whether moderation was principle or fear. The sources disagree, and a good debrief keeps that open.",
    coachNotes: "Ask what the war was for before letting the learner choose. If they march on Vienna, ask what France does next. In the Nikolsburg turn, ask what they are willing to give up to end the war this month.",
  },
};
