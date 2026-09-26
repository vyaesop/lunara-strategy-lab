import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAIFromEnv } from "@lunara/ai";
import { buildApp } from "./app";
import { openDb, type DbHandle } from "./db/client";
import { loadEnv } from "./env";
import { createUsageSink } from "./services/usage";

/**
 * End-to-end route tests on an in-memory PGlite database with the mock AI
 * provider. No network, no credentials.
 */
let handle: DbHandle;
let app: ReturnType<typeof buildApp>["app"];

interface Client {
  token: string;
  call: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>;
}

async function signUp(email: string, name: string): Promise<Client> {
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: JSON.stringify({ email, password: "correct-horse-battery", name }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
  const token = res.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  const call: Client["call"] = async (path, init = {}) => {
    const { json, ...rest } = init;
    return app.request(path, {
      ...rest,
      headers: {
        authorization: `Bearer ${token}`,
        origin: "http://localhost:5173",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  };
  return { token: token!, call };
}

beforeAll(async () => {
  handle = await openDb({ pgliteDataDir: "memory://", migrate: true });
  // Budget of 12 per user: enough for a council (6 calls) plus follow-ups; the budget test exhausts it deliberately.
  const env = loadEnv({ NODE_ENV: "test", RATE_LIMIT_PER_MINUTE: "1000", AI_DAILY_REQUEST_LIMIT: "12", ADMIN_EMAILS: "admin@example.test" });
  const ai = buildAIFromEnv({}, { usageSink: createUsageSink(handle.db) });
  app = buildApp({ db: handle.db, env, ai, quiet: true }).app;
});

afterAll(async () => {
  await handle.close();
});

describe("auth and profile", () => {
  it("rejects unauthenticated access", async () => {
    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthenticated");
  });

  it("bootstraps a profile on first call and persists preferences", async () => {
    const alice = await signUp("alice@example.test", "Alice");
    const me = await alice.call("/api/v1/me");
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.profile.email).toBe("alice@example.test");
    expect(body.profile.onboarding.completed).toBe(false);
    expect(body.skills).toEqual([]);

    const patched = await alice.call("/api/v1/me/preferences", { method: "PATCH", json: { coachingIntensity: "demanding" } });
    expect(patched.status).toBe(200);
    expect((await patched.json()).profile.preferences.coachingIntensity).toBe("demanding");

    const onboarded = await alice.call("/api/v1/me/onboarding", {
      method: "POST",
      json: { answers: { primaryGoals: ["Think clearly"], startWith: "deduction" }, preferences: { sessionLength: "short" } },
    });
    expect(onboarded.status).toBe(200);
    const p = (await onboarded.json()).profile;
    expect(p.onboarding.completed).toBe(true);
    expect(p.preferences.sessionLength).toBe("short");
    expect(p.preferences.coachingIntensity).toBe("demanding");
  });

  it("validates bodies", async () => {
    const bob = await signUp("bob@example.test", "Bob");
    const res = await bob.call("/api/v1/me/preferences", { method: "PATCH", json: { coachingIntensity: "brutal" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });
});

describe("exercises", () => {
  it("lists published exercises without hidden material", async () => {
    const u = await signUp("carol@example.test", "Carol");
    const res = await u.call("/api/v1/exercises");
    expect(res.status).toBe(200);
    const { exercises } = await res.json();
    expect(exercises.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(exercises)).not.toMatch(/SOLUTION|Worked reasoning/);
  });
});

describe("coaching session lifecycle", () => {
  it("runs the full loop with server-authoritative phases and hidden-material release", async () => {
    const u = await signUp("dave@example.test", "Dave");
    const created = await u.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-locked-archive" } });
    expect(created.status).toBe(201);
    const { session } = await created.json();
    expect(session.phase).toBe("introduction");
    const id = session.id as string;

    // Hint in introduction is refused by the machine.
    const earlyHint = await u.call(`/api/v1/sessions/${id}/hint`, { method: "POST", json: {} });
    expect(earlyHint.status).toBe(400);

    // First message moves to initial_understanding and gets a coach reply (mock).
    const turn = await u.call(`/api/v1/sessions/${id}/messages`, { method: "POST", json: { content: "A ledger is missing and I need to say what the logs prove." } });
    expect(turn.status, await turn.clone().text()).toBe(200);
    const t = await turn.json();
    expect(t.coachMessage.role).toBe("coach");
    expect(t.session.phase).toBe("initial_understanding");

    // Hidden material is not released.
    let detail = await (await u.call(`/api/v1/sessions/${id}`)).json();
    expect(detail.released.solution).toBeNull();
    expect(detail.released.hints).toEqual([]);

    // Hypothesis auto-advances to hypothesis phase.
    const hyp = await u.call(`/api/v1/sessions/${id}/hypotheses`, {
      method: "POST",
      json: { statement: "Bram used Cato's badge at 18:20.", supportingEvidence: ["Badge in Bram's desk"], contradictingEvidence: [], assumptions: ["Cato really lost it"], confidence: 0.6 },
    });
    expect(hyp.status, await hyp.clone().text()).toBe(200);
    expect((await hyp.json()).session.phase).toBe("hypothesis");

    // Sequential hints: level 1 ok, level 3 refused.
    const h1 = await u.call(`/api/v1/sessions/${id}/hint`, { method: "POST", json: {} });
    expect(h1.status).toBe(200);
    expect((await h1.json()).hint.kind).toBe("hint");
    const h3 = await u.call(`/api/v1/sessions/${id}/hint`, { method: "POST", json: { level: 3 } });
    expect(h3.status).toBe(400);

    // Cannot skip to final decision.
    const skip = await u.call(`/api/v1/sessions/${id}/advance`, { method: "POST", json: { to: "final_decision" } });
    expect(skip.status).toBe(400);

    // Decision requires the final_decision phase.
    const earlyDecision = await u.call(`/api/v1/sessions/${id}/decision`, { method: "POST", json: { text: "Bram", rationale: "desk", confidence: 0.9 } });
    expect(earlyDecision.status).toBe(400);

    for (const to of ["evidence_challenge", "revision", "final_decision"]) {
      const r = await u.call(`/api/v1/sessions/${id}/advance`, { method: "POST", json: { to } });
      expect(r.status, `${to}: ${await r.clone().text()}`).toBe(200);
    }
    const decided = await u.call(`/api/v1/sessions/${id}/decision`, {
      method: "POST",
      json: { text: "Bram or Cato; cannot decide", rationale: "Ada and Dana excluded; badge C used at 18:20.", confidence: 0.7 },
    });
    expect(decided.status).toBe(200);
    const d = await decided.json();
    expect(d.session.phase).toBe("debrief");
    expect(d.released.solution).toMatch(/Bram or Cato/);
    expect(d.released.debrief).toBeTruthy();

    detail = await (await u.call(`/api/v1/sessions/${id}`)).json();
    expect(detail.session.messageCount).toBeGreaterThanOrEqual(4);
    expect(detail.messages.some((m: { kind: string }) => m.kind === "hint")).toBe(true);

    // Resume list.
    const list = await (await u.call("/api/v1/sessions")).json();
    expect(list.sessions.map((s: { id: string }) => s.id)).toContain(id);

    // Assessment: structured (mock echoes the example), server computes aggregates, skills get evidence.
    const assessed = await u.call(`/api/v1/sessions/${id}/assess`, { method: "POST", json: {} });
    expect(assessed.status, await assessed.clone().text()).toBe(200);
    const a = await assessed.json();
    expect(a.session.phase).toBe("skill_update");
    expect(a.session.assessment.criteria).toHaveLength(4);
    expect(a.session.assessment.overallScore).toBeCloseTo(0.5);
    expect(a.session.assessment.hintLevelUsed).toBe(1);
    expect(a.session.assessment.unaidedScore).toBeCloseTo(0.5 * (1 - 0.12));
    expect(a.session.assessment.outcomeQuality).toBe("incorrect_poorly_supported"); // mock example marks fixed answers incorrect
    expect(a.skills.length).toBeGreaterThanOrEqual(2);
    expect(a.skills.every((s: { evidenceCount: number }) => s.evidenceCount === 1)).toBe(true);
    // Idempotent.
    const again = await u.call(`/api/v1/sessions/${id}/assess`, { method: "POST", json: {} });
    expect(again.status).toBe(200);

    // Finishing the flow closes the session and updates the streak.
    const done = await u.call(`/api/v1/sessions/${id}/advance`, { method: "POST", json: { to: "completed" } });
    expect(done.status, await done.clone().text()).toBe(200);
    detail = await (await u.call(`/api/v1/sessions/${id}`)).json();
    expect(detail.session.status).toBe("completed");
    expect(detail.session.completedAt).toBeTruthy();
    const me = await (await u.call("/api/v1/me")).json();
    expect(me.profile.stats.sessionsCompleted).toBe(1);
    expect(me.profile.stats.streak.current).toBe(1);
    expect(me.skills.length).toBeGreaterThanOrEqual(2);

    // Recommendations are explained and never repeat the attempted exercise first.
    const rec = await (await u.call("/api/v1/recommendations")).json();
    expect(rec.primary).toBeTruthy();
    expect(rec.primary.exercise.id).not.toBe("ex-locked-archive");
    expect(rec.primary.reason).toMatch(/Recommended because/);
    // A completed session refuses further mutation.
    const late = await u.call(`/api/v1/sessions/${id}/hint`, { method: "POST", json: {} });
    expect(late.status).toBe(409);
  });

  it("refuses assessment before the debrief phase", async () => {
    const u = await signUp("early@example.test", "Early");
    const { session } = await (await u.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-miracle-cohort" } })).json();
    const r = await u.call(`/api/v1/sessions/${session.id}/assess`, { method: "POST", json: {} });
    expect(r.status).toBe(409);
  });

  it("isolates sessions between users", async () => {
    const owner = await signUp("erin@example.test", "Erin");
    const other = await signUp("frank@example.test", "Frank");
    const created = await owner.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-miracle-cohort" } });
    const { session } = await created.json();
    const stolen = await other.call(`/api/v1/sessions/${session.id}`);
    expect(stolen.status).toBe(404);
    const hint = await other.call(`/api/v1/sessions/${session.id}/hint`, { method: "POST", json: {} });
    expect(hint.status).toBe(404);
  });

  it("enforces the daily AI request budget", async () => {
    const u = await signUp("gina@example.test", "Gina");
    const { session } = await (await u.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-regional-launch" } })).json();
    let last = 0;
    for (let i = 0; i < 14; i++) {
      const r = await u.call(`/api/v1/sessions/${session.id}/messages`, { method: "POST", json: { content: `turn ${i}` } });
      last = r.status;
      if (last !== 200) {
        expect((await r.json()).error.code).toBe("budget_exceeded");
        break;
      }
    }
    expect(last).toBe(429);
  });

  it("runs an investigation: deterministic evidence release, linked hypotheses, evaluation", async () => {
    const u = await signUp("holmes@example.test", "Holmes");
    const list = await (await u.call("/api/v1/investigations")).json();
    expect(list.investigations.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list)).not.toMatch(/groundTruth|actionReveals/);

    const created = await u.call("/api/v1/investigations/inv-warehouse-fire/sessions", { method: "POST", json: {} });
    expect(created.status).toBe(201);
    let view = await created.json();
    const id = view.session.id as string;
    expect(view.session.pointsRemaining).toBe(12);
    expect(view.revealedEvidence.map((e: { id: string }) => e.id)).toEqual(["ev-callout", "ev-petra-statement"]);
    expect(view.groundTruth).toBeNull();

    // Linking unrevealed evidence is refused.
    const badHyp = await u.call(`/api/v1/investigation-sessions/${id}/hypotheses`, {
      method: "POST",
      json: { statement: "Electrical", answerEntityId: "ent-electrical", links: [{ evidenceId: "ev-electrical", relation: "supports", weight: 3 }], assumptions: [], confidence: 0.5, revisesId: null },
    });
    expect(badHyp.status).toBe(400);

    // Prerequisite: lab needs the scene first.
    const early = await u.call(`/api/v1/investigation-sessions/${id}/actions`, { method: "POST", json: { actionId: "act-lab" } });
    expect(early.status).toBe(400);
    for (const actionId of ["act-scene", "act-lab", "act-electrical", "act-cctv"]) {
      const r = await u.call(`/api/v1/investigation-sessions/${id}/actions`, { method: "POST", json: { actionId } });
      expect(r.status, `${actionId}: ${await r.clone().text()}`).toBe(200);
      view = await r.json();
    }
    expect(view.session.pointsRemaining).toBe(0);
    expect(view.revealedEvidence.map((e: { id: string }) => e.id)).toContain("ev-electrical");
    const broke = await u.call(`/api/v1/investigation-sessions/${id}/actions`, { method: "POST", json: { actionId: "act-alarm" } });
    expect(broke.status).toBe(400);

    const hyp = await u.call(`/api/v1/investigation-sessions/${id}/hypotheses`, {
      method: "POST",
      json: {
        statement: "Overloaded extension lead started the fire.",
        answerEntityId: "ent-electrical",
        links: [
          { evidenceId: "ev-origin", relation: "supports", weight: 3 },
          { evidenceId: "ev-lab", relation: "supports", weight: 3 },
          { evidenceId: "ev-electrical", relation: "supports", weight: 3 },
          { evidenceId: "ev-cctv", relation: "supports", weight: 2 },
          { evidenceId: "ev-petra-statement", relation: "contradicts", weight: 1 },
        ],
        assumptions: ["The engineer's report is reliable"],
        confidence: 0.85,
        revisesId: null,
      },
    });
    expect(hyp.status, await hyp.clone().text()).toBe(200);
    view = await hyp.json();
    const hid = view.session.hypotheses[0].id as string;

    const concluded = await u.call(`/api/v1/investigation-sessions/${id}/conclude`, {
      method: "POST",
      json: { hypothesisId: hid, rationale: "Origin, lab, engineer and CCTV converge on an accidental fault.", confidence: 0.85 },
    });
    expect(concluded.status, await concluded.clone().text()).toBe(200);
    view = await concluded.json();
    expect(view.session.status).toBe("completed");
    expect(view.session.evaluation.correct).toBe(true);
    expect(view.session.evaluation.evidenceCoverage).toBe(1);
    expect(view.session.evaluation.misledByCount).toBe(0);
    expect(view.session.evaluation.outcomeQuality).toBe("correct_by_coincidence"); // mock rubric scores 0.5 < 0.6
    expect(view.groundTruth.answerEntityId).toBe("ent-electrical");
    expect(view.groundTruth.debrief).toBeTruthy();

    const me = await (await u.call("/api/v1/me")).json();
    expect(me.skills.length).toBeGreaterThanOrEqual(3);
    expect(me.profile.stats.sessionsCompleted).toBe(1);
  });

  it("scenario trees: create, save with optimistic concurrency, structural critique, ownership", async () => {
    const u = await signUp("planner@example.test", "Planner");
    const created = await u.call("/api/v1/trees", { method: "POST", json: { title: "Enter the South", objective: "Credible growth in four months" } });
    expect(created.status).toBe(201);
    let { tree } = await created.json();
    expect(tree.graph.nodes).toHaveLength(1);
    const root = tree.graph.nodes[0].id as string;
    const node = (id: string, type: string, title: string) => ({ id, type, title, description: "", preconditions: "", probability: null, cost: "", time: "", risk: null, evidenceRefs: [], notes: "", position: { x: 0, y: 0 }, collapsed: false });
    const graph = {
      nodes: [tree.graph.nodes[0], node("d1", "decision", "Launch South"), node("o1", "outcome", "Win")],
      edges: [{ id: "e1", source: root, target: "d1", label: "" }, { id: "e2", source: "d1", target: "o1", label: "" }],
    };
    const saved = await u.call(`/api/v1/trees/${tree.id}`, { method: "PUT", json: { graph, baseVersion: 1 } });
    expect(saved.status, await saved.clone().text()).toBe(200);
    tree = (await saved.json()).tree;
    expect(tree.version).toBe(2);
    expect(tree.history).toHaveLength(1);

    const stale = await u.call(`/api/v1/trees/${tree.id}`, { method: "PUT", json: { graph, baseVersion: 1 } });
    expect(stale.status).toBe(409);

    const crit = await u.call(`/api/v1/trees/${tree.id}/critique`, { method: "POST", json: { mode: "independent" } });
    expect(crit.status).toBe(200);
    const { critique } = await crit.json();
    expect(critique.findings.some((f: { kind: string }) => f.kind === "missing_branch")).toBe(true);
    expect(critique.findings.every((f: { source: string }) => f.source === "structural")).toBe(true);
    expect(critique.shownCount).toBe(0);

    const hints = await u.call(`/api/v1/trees/${tree.id}/critique`, { method: "POST", json: { mode: "hints" } });
    expect(hints.status, await hints.clone().text()).toBe(200);
    const h = await hints.json();
    expect(h.critique.shownCount).toBe(3);
    expect(h.critique.findings.some((f: { source: string }) => f.source === "ai")).toBe(true);

    const other = await signUp("thief@example.test", "Thief");
    expect((await other.call(`/api/v1/trees/${tree.id}`)).status).toBe(404);
    expect((await other.call(`/api/v1/trees/${tree.id}`, { method: "PUT", json: { graph, baseVersion: 2 } })).status).toBe(404);
  });

  it("plays a historical simulation with hidden state, counterfactual labels and a debrief", async () => {
    const u = await signUp("otto@example.test", "Otto");
    const list = await (await u.call("/api/v1/simulations")).json();
    expect(list.simulations.length).toBeGreaterThanOrEqual(2);
    const bismarck = list.simulations.find((s: { id: string }) => s.id === "sim-bismarck-1866");
    expect(bismarck.claims.every((c: { sourceIds: string[] }) => c.sourceIds.length > 0)).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/effects|historicalMatch|counterfactualNote/);

    const created = await u.call("/api/v1/simulations/sim-bismarck-1866/sessions", { method: "POST", json: {} });
    expect(created.status).toBe(201);
    let view = await created.json();
    const id = view.session.id as string;
    expect(view.turn.id).toBe("t-aims");
    expect(JSON.stringify(view.turn)).not.toMatch(/effects|hidden/);
    // Hidden resource is reported as a band, not a number.
    const french = view.resources.find((r: { key: string }) => r.key === "french_intervention");
    expect(french.value).toBeNull();
    expect(french.band).toBe("mid");
    expect(view.historicalRecord).toBeNull();

    // Counterfactual branch is labelled and changes resources deterministically.
    const march = await u.call(`/api/v1/simulation-sessions/${id}/decide`, { method: "POST", json: { turnId: "t-aims", optionId: "o-vienna", rationale: "Press the advantage.", confidence: 0.7 } });
    expect(march.status, await march.clone().text()).toBe(200);
    view = await march.json();
    expect(view.narration[0].kind).toBe("counterfactual");
    expect(view.resources.find((r: { key: string }) => r.key === "army_readiness").value).toBe(50);
    expect(view.session.decisions[0].historicalMatch).toBe(false);
    expect(view.turn.id).toBe("t-nikolsburg");

    // Wrong turn id is refused.
    const wrong = await u.call(`/api/v1/simulation-sessions/${id}/decide`, { method: "POST", json: { turnId: "t-aims", optionId: "o-moderate" } });
    expect(wrong.status).toBe(400);

    const persuade = await u.call(`/api/v1/simulation-sessions/${id}/decide`, { method: "POST", json: { turnId: "t-nikolsburg", optionId: "o-persuade", rationale: "End it before France moves." } });
    expect(persuade.status).toBe(200);
    const final = await u.call(`/api/v1/simulation-sessions/${id}/decide`, { method: "POST", json: { turnId: "t-south", optionId: "o-alliances", rationale: "Bind the south quietly." } });
    expect(final.status, await final.clone().text()).toBe(200);
    view = await final.json();
    expect(view.session.status).toBe("completed");
    expect(view.session.evaluation.turnsPlayed).toBe(3);
    expect(view.session.evaluation.historicalMatches).toBe(2);
    expect(view.historicalRecord.decision).toMatch(/moderate peace/);
    expect(view.historicalRecord.sourceIds.length).toBeGreaterThan(0);
    const me = await (await u.call("/api/v1/me")).json();
    expect(me.profile.stats.sessionsCompleted).toBe(1);
  });

  it("convenes a council: independent role analyses, cross-critique, follow-up, user decision", async () => {
    const u = await signUp("council@example.test", "Council");
    const created = await u.call("/api/v1/council", {
      method: "POST",
      json: { title: "Enter the South", brief: "We have five months of cash and two regions. I lean South because there is no incumbent. Plan: build the feature in month one, hire two sales reps, launch in month three.", roles: ["strategist", "skeptic", "opponent"], depth: "concise" },
    });
    expect(created.status, await created.clone().text()).toBe(201);
    let { council } = await created.json();
    expect(council.status).toBe("open");
    expect(council.analyses.map((a: { role: string }) => a.role).sort()).toEqual(["opponent", "skeptic", "strategist"]);
    expect(council.critiques).toHaveLength(3);
    expect(council.decision).toBeNull();
    expect(council.usage.calls).toBe(6);

    const ask = await u.call(`/api/v1/council/${council.id}/ask`, { method: "POST", json: { role: "opponent", question: "What would you do in week two?" } });
    expect(ask.status, await ask.clone().text()).toBe(200);
    council = (await ask.json()).council;
    expect(council.exchanges).toHaveLength(2);
    expect(council.exchanges[1].role).toBe("opponent");

    const badRole = await u.call(`/api/v1/council/${council.id}/ask`, { method: "POST", json: { role: "auditor", question: "?" } });
    expect(badRole.status).toBe(400);

    const decided = await u.call(`/api/v1/council/${council.id}/decision`, {
      method: "POST",
      json: { decision: "Run three weeks of discovery first", rationale: "The skeptic's point about the feature build stands.", accepted: ["Discovery before build"], rejected: ["Hire reps in month one"], toInvestigate: ["Regulatory requirement"], confidence: 0.6 },
    });
    expect(decided.status, await decided.clone().text()).toBe(200);
    council = (await decided.json()).council;
    expect(council.status).toBe("decided");
    expect(council.decision.accepted).toEqual(["Discovery before build"]);

    const other = await signUp("eavesdrop@example.test", "Eaves");
    expect((await other.call(`/api/v1/council/${council.id}`)).status).toBe(404);
  });

  it("reading: documents, paged text, notes, ask and generate with bounded passages, deletion", async () => {
    const u = await signUp("reader@example.test", "Reader");
    const long = Array.from({ length: 400 }, (_, i) => `Paragraph ${i}: base rates matter when a screen flags a rare event, because most flags are false positives.`).join("\n\n");
    const created = await u.call("/api/v1/reading/documents", { method: "POST", json: { kind: "text", title: "Notes on Bayes", content: long, author: "Me" } });
    expect(created.status, await created.clone().text()).toBe(201);
    const { document } = await created.json();
    expect(document.length).toBe(long.length);

    const page = await (await u.call(`/api/v1/reading/documents/${document.id}/text?offset=0&limit=500`)).json();
    expect(page.text.length).toBe(500);
    expect(page.total).toBe(long.length);

    const note = await u.call("/api/v1/reading/notes", { method: "POST", json: { documentId: document.id, kind: "excerpt", content: "most flags are false positives", range: { start: 60, end: 100 }, origin: "typed" } });
    expect(note.status).toBe(201);
    const badNote = await u.call("/api/v1/reading/notes", { method: "POST", json: { documentId: "doc_nope", kind: "note", content: "x" } });
    expect(badNote.status).toBe(404);

    const ask = await u.call(`/api/v1/reading/documents/${document.id}/ask`, { method: "POST", json: { question: "Why do most flags turn out false?", range: null } });
    expect(ask.status, await ask.clone().text()).toBe(200);
    const a = await ask.json();
    expect(a.passage.end - a.passage.start).toBeLessThanOrEqual(6000);
    expect(a.answer.length).toBeGreaterThan(0);

    const gen = await u.call(`/api/v1/reading/documents/${document.id}/generate`, { method: "POST", json: { range: { start: 0, end: 1500 } } });
    expect(gen.status, await gen.clone().text()).toBe(200);
    const g = await gen.json();
    expect(g.generated.comprehension.length).toBeGreaterThan(0);

    // AI disabled per document is enforced.
    await u.call(`/api/v1/reading/documents/${document.id}`, { method: "PATCH", json: { aiAllowed: false, progress: 0.4 } });
    expect((await u.call(`/api/v1/reading/documents/${document.id}/ask`, { method: "POST", json: { question: "?" } })).status).toBe(403);

    const other = await signUp("snoop@example.test", "Snoop");
    expect((await other.call(`/api/v1/reading/documents/${document.id}/text`)).status).toBe(404);

    expect((await u.call(`/api/v1/reading/documents/${document.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await u.call(`/api/v1/reading/documents/${document.id}`)).status).toBe(404);
    const notes = await (await u.call("/api/v1/reading/notes")).json();
    expect(notes.notes).toHaveLength(0);
  });

  it("knowledge graph: dedup on create, relations validated, merge re-points references", async () => {
    const u = await signUp("graph@example.test", "Graph");
    const c1 = await (await u.call("/api/v1/knowledge/concepts", { method: "POST", json: { name: "Base rate", kind: "concept", summary: "Prior frequency" } })).json();
    const dup = await u.call("/api/v1/knowledge/concepts", { method: "POST", json: { name: "base-rate", kind: "concept" } });
    expect(dup.status).toBe(200);
    expect((await dup.json()).concept.id).toBe(c1.concept.id);
    const c2 = await (await u.call("/api/v1/knowledge/concepts", { method: "POST", json: { name: "Likelihood ratio", kind: "technique" } })).json();
    const c3 = await (await u.call("/api/v1/knowledge/concepts", { method: "POST", json: { name: "Prior probability", kind: "concept" } })).json();

    const rel = await u.call("/api/v1/knowledge/relations", { method: "POST", json: { fromId: c2.concept.id, toId: c1.concept.id, kind: "depends_on" } });
    expect(rel.status).toBe(201);
    expect((await u.call("/api/v1/knowledge/relations", { method: "POST", json: { fromId: c2.concept.id, toId: c1.concept.id, kind: "depends_on" } })).status).toBe(400);
    expect((await u.call("/api/v1/knowledge/relations", { method: "POST", json: { fromId: c1.concept.id, toId: c1.concept.id, kind: "supports" } })).status).toBe(400);

    const rel2 = await u.call("/api/v1/knowledge/relations", { method: "POST", json: { fromId: c3.concept.id, toId: c2.concept.id, kind: "explains" } });
    expect(rel2.status).toBe(201);
    const merged = await u.call(`/api/v1/knowledge/concepts/${c3.concept.id}/merge`, { method: "POST", json: { intoId: c1.concept.id } });
    expect(merged.status, await merged.clone().text()).toBe(200);
    const graph = await (await u.call("/api/v1/knowledge/graph")).json();
    expect(graph.concepts).toHaveLength(2);
    expect(graph.concepts.find((c: { id: string }) => c.id === c1.concept.id).aliases).toContain("Prior probability");
    expect(graph.relations.some((r: { fromId: string; toId: string }) => r.fromId === c1.concept.id && r.toId === c2.concept.id)).toBe(true);
  });

  it("spaced repetition: due queue, grading reschedules with FSRS, retention evidence", async () => {
    const u = await signUp("memory@example.test", "Memory");
    const created = await u.call("/api/v1/review/items/batch", {
      method: "POST",
      json: { items: [
        { kind: "concept", prompt: "What is a base rate?", answer: "The prior frequency of an event before evidence." },
        { kind: "technique", prompt: "How do you update odds with a likelihood ratio?", answer: "Multiply prior odds by the ratio." },
      ] },
    });
    expect(created.status, await created.clone().text()).toBe(201);
    let queue = await (await u.call("/api/v1/review/queue")).json();
    expect(queue.dueCount).toBe(2);
    expect(queue.due[0].preview.good).toBeGreaterThanOrEqual(0);
    const id = queue.due[0].id as string;
    const graded = await u.call(`/api/v1/review/items/${id}/grade`, { method: "POST", json: { rating: "good", explanation: "It is the prior frequency." } });
    expect(graded.status, await graded.clone().text()).toBe(200);
    const g = await graded.json();
    expect(g.item.card.reps).toBe(1);
    expect(g.item.history).toHaveLength(1);
    queue = await (await u.call("/api/v1/review/queue")).json();
    expect(queue.dueCount).toBe(1);
    const me = await (await u.call("/api/v1/me")).json();
    expect(me.skills.find((s: { skillId: string }) => s.skillId === "learning_retention").evidenceCount).toBe(1);
    const rec = await (await u.call("/api/v1/recommendations")).json();
    expect(rec.reviewsDue).toBe(1);
  });

  it("strategy lab: projects with sections and suggestions, decision journal with predictions and calibration, daily briefing", async () => {
    const u = await signUp("founder@example.test", "Founder");
    const created = await u.call("/api/v1/projects", { method: "POST", json: { title: "Launch South", summary: "Five months of cash." } });
    expect(created.status).toBe(201);
    let { project } = await created.json();
    const item = await u.call(`/api/v1/projects/${project.id}/items`, { method: "PUT", json: { section: "assumptions", text: "The feature takes ten weeks" } });
    expect(item.status).toBe(200);
    project = (await item.json()).project;
    expect(project.sections.assumptions).toHaveLength(1);
    const suggest = await u.call(`/api/v1/projects/${project.id}/suggest`, { method: "POST", json: {} });
    expect(suggest.status, await suggest.clone().text()).toBe(200);
    expect((await suggest.json()).suggestions.suggestions.length).toBeGreaterThan(0);
    // Suggestions are not applied automatically.
    project = (await (await u.call(`/api/v1/projects/${project.id}`)).json()).project;
    expect(project.sections.assumptions).toHaveLength(1);

    const dec = await u.call("/api/v1/journal", {
      method: "POST",
      json: {
        projectId: project.id,
        title: "Discovery first",
        context: "Two regions, limited cash.",
        objective: "Credible growth evidence in four months",
        chosenAction: "Three weeks of discovery calls",
        rationale: "Cheap information before expensive commitment.",
        confidence: 0.7,
        predictions: [
          { statement: "At least 5 of 10 operators say they would pay", probability: 0.6, invalidatingEvidence: "Fewer than 3 interested" },
          { statement: "The regulator confirms data residency is required", probability: 0.8 },
        ],
      },
    });
    expect(dec.status, await dec.clone().text()).toBe(201);
    let { decision } = await dec.json();
    expect(decision.predictions).toHaveLength(2);
    const pid = decision.predictions[0].id as string;
    const resolved = await u.call(`/api/v1/journal/${decision.id}/predictions/${pid}/resolve`, { method: "POST", json: { resolved: true, resolutionNote: "6 of 10" } });
    expect(resolved.status).toBe(200);
    decision = (await resolved.json()).decision;
    expect(decision.predictions[0].resolved).toBe(true);
    const reviewed = await u.call(`/api/v1/journal/${decision.id}/review`, { method: "POST", json: { actualOutcome: "Went ahead with the South.", lessons: "Discovery was worth it." } });
    expect((await reviewed.json()).decision.status).toBe("reviewed");
    const list = await (await u.call("/api/v1/journal")).json();
    expect(list.calibration.resolvedCount).toBe(1);
    expect(list.calibration.enoughData).toBe(false); // never shown with one data point

    const briefing = await u.call("/api/v1/briefing/today");
    expect(briefing.status, await briefing.clone().text()).toBe(200);
    const b = await briefing.json();
    expect(b.briefing.puzzle.prompt.length).toBeGreaterThan(10);
    expect(b.briefing.strategicQuestion.length).toBeGreaterThan(10);
    expect(b.exercise).toBeTruthy();
    const again = await (await u.call("/api/v1/briefing/today")).json();
    expect(again.briefing.puzzle.id).toBe(b.briefing.puzzle.id); // precomputed, no model call
    const respond = await u.call(`/api/v1/briefing/${b.briefing.date}/respond`, { method: "POST", json: { puzzleAnswer: "A", puzzleCorrectSelf: false } });
    expect(respond.status).toBe(200);
    expect((await respond.json()).briefing.responses.puzzleAnswer).toBe("A");

    const other = await signUp("intruder@example.test", "Intruder");
    expect((await other.call(`/api/v1/projects/${project.id}`)).status).toBe(404);
    expect((await other.call(`/api/v1/journal/${decision.id}`)).status).toBe(404);
  });

  it("negotiation: engine decides acceptance, counterpart voices it, evaluation reveals incentives", async () => {
    const u = await signUp("dealmaker@example.test", "Dealmaker");
    const list = await (await u.call("/api/v1/negotiations")).json();
    expect(JSON.stringify(list)).not.toMatch(/weights|acceptThreshold|persona/);
    const created = await u.call("/api/v1/negotiations/neg-salary-offer/sessions", { method: "POST", json: {} });
    expect(created.status, await created.clone().text()).toBe(201);
    let view = await created.json();
    const id = view.session.id as string;
    expect(view.session.messages[0].role).toBe("counterpart");

    const said = await u.call(`/api/v1/negotiation-sessions/${id}/say`, { method: "POST", json: { content: "Before numbers: what flexibility is there on start date?" } });
    expect(said.status, await said.clone().text()).toBe(200);
    view = await said.json();
    expect(view.session.messages.at(-1).role).toBe("counterpart");

    // Greedy proposal is countered deterministically.
    const greedy = await u.call(`/api/v1/negotiation-sessions/${id}/propose`, { method: "POST", json: { terms: { salary: 112, start_weeks: 10, remote_days: 4 }, message: "Here is my ask." } });
    expect(greedy.status, await greedy.clone().text()).toBe(200);
    view = await greedy.json();
    expect(view.session.proposals[0].response).toBe("countered");
    expect(view.currentOffer).toBeTruthy();
    expect(view.session.status).toBe("active");
    const invalidTerms = await u.call(`/api/v1/negotiation-sessions/${id}/propose`, { method: "POST", json: { terms: { salary: 500, start_weeks: 6, remote_days: 2 } } });
    expect(invalidTerms.status).toBe(400);

    // Reasonable proposal is accepted.
    const fair = await u.call(`/api/v1/negotiation-sessions/${id}/propose`, { method: "POST", json: { terms: { salary: 97, start_weeks: 6, remote_days: 2 } } });
    expect(fair.status, await fair.clone().text()).toBe(200);
    view = await fair.json();
    expect(view.session.status).toBe("completed");
    expect(view.session.outcome.dealReached).toBe(true);
    expect(view.session.outcome.terms.salary).toBe(97);

    const evaluated = await u.call(`/api/v1/negotiation-sessions/${id}/evaluate`, { method: "POST", json: {} });
    expect(evaluated.status, await evaluated.clone().text()).toBe(200);
    view = await evaluated.json();
    expect(view.session.evaluation.counterpartIncentives).toMatch(/band/);
    expect(view.session.evaluation.userValue).toBeGreaterThan(0);
  });

  it("missions: ordered steps, custom mission from a project, debrief applies skill evidence", async () => {
    const u = await signUp("missionary@example.test", "Missionary");
    const list = await (await u.call("/api/v1/missions")).json();
    expect(list.missions.length).toBeGreaterThanOrEqual(2);
    const custom = await u.call("/api/v1/missions/custom", {
      method: "POST",
      json: { title: "Hire a first salesperson", summary: "Decide whether and how.", objectives: ["A defensible hiring decision"], steps: [
        { title: "What must be true", kind: "reflection", prompt: "What must be true for this hire to pay back within a year?" },
        { title: "Decide", kind: "decision", prompt: "Decide, with a trigger to revisit." },
      ] },
    });
    expect(custom.status, await custom.clone().text()).toBe(201);
    const { mission } = await custom.json();
    expect(mission.source).toBe("custom");
    const started = await u.call(`/api/v1/missions/${mission.id}/sessions`, { method: "POST", json: {} });
    expect(started.status).toBe(201);
    let { session } = await started.json();
    const [s1, s2] = session.definition.steps;
    const outOfOrder = await u.call(`/api/v1/mission-sessions/${session.id}/steps`, { method: "POST", json: { stepId: s2.id, response: "Hire." } });
    expect(outOfOrder.status).toBe(400);
    const early = await u.call(`/api/v1/mission-sessions/${session.id}/debrief`, { method: "POST", json: {} });
    expect(early.status).toBe(409);
    expect((await u.call(`/api/v1/mission-sessions/${session.id}/steps`, { method: "POST", json: { stepId: s1.id, response: "Pipeline of 20 leads a month and a 15% close rate." } })).status).toBe(200);
    expect((await u.call(`/api/v1/mission-sessions/${session.id}/steps`, { method: "POST", json: { stepId: s2.id, response: "Hire on a six-month contract; revisit if fewer than 10 leads by month three." } })).status).toBe(200);
    const debriefed = await u.call(`/api/v1/mission-sessions/${session.id}/debrief`, { method: "POST", json: {} });
    expect(debriefed.status, await debriefed.clone().text()).toBe(200);
    session = (await debriefed.json()).session;
    expect(session.status).toBe("completed");
    expect(session.debrief.criteria).toHaveLength(3);
    const me = await (await u.call("/api/v1/me")).json();
    expect(me.skills.some((s: { skillId: string }) => s.skillId === "decision_quality")).toBe(true);
  });

  it("management game: deterministic turns, validation, quarterly reports, evaluation with personal rank", async () => {
    const u = await signUp("merchant@example.test", "Merchant");
    const created = await u.call("/api/v1/game", { method: "POST", json: {} });
    expect(created.status).toBe(201);
    let view = await created.json();
    const id = view.session.id as string;
    expect(view.session.state.month).toBe(1);
    expect(view.session.state).not.toHaveProperty("morale");
    expect(view.session.state.moraleBand).toBe("mid");
    const tooMuch = await u.call(`/api/v1/game/${id}/turn`, { method: "POST", json: { buyUnits: 5000, sellPrice: 100, marketing: 0 } });
    expect(tooMuch.status).toBe(400);
    for (let m = 1; m <= 12; m++) {
      const r = await u.call(`/api/v1/game/${id}/turn`, { method: "POST", json: { buyUnits: Math.min(300, view.session.state.capacity - view.session.state.inventory), sellPrice: Math.round(view.session.state.marketPrice * 1.05), marketing: 1000, rationale: "steady" } });
      expect(r.status, `month ${m}: ${await r.clone().text()}`).toBe(200);
      view = await r.json();
    }
    expect(view.session.status).toBe("completed");
    expect(view.reports).toHaveLength(4);
    const evaluated = await u.call(`/api/v1/game/${id}/evaluate`, { method: "POST", json: {} });
    expect(evaluated.status, await evaluated.clone().text()).toBe(200);
    view = await evaluated.json();
    expect(view.session.evaluation.personalRank).toBe(1);
    expect(view.session.evaluation.personalRuns).toBe(1);
    expect((await u.call(`/api/v1/game/${id}/turn`, { method: "POST", json: { buyUnits: 0, sellPrice: 100, marketing: 0 } })).status).toBe(409);
  });

  it("master challenge: staged progression, evidence budget, adversarial review, assessment vs previous", async () => {
    const u = await signUp("challenger@example.test", "Challenger");
    const list = await (await u.call("/api/v1/challenges")).json();
    expect(list.challenges).toHaveLength(1);
    expect(JSON.stringify(list)).not.toMatch(/referenceAnalysis|actionReveals/);
    const started = await u.call("/api/v1/challenges/chal-port-concession/attempts", { method: "POST", json: {} });
    expect(started.status).toBe(201);
    let view = await started.json();
    const id = view.attempt.id as string;
    const base = `/api/v1/challenges/attempts/${id}/stage`;
    // Out-of-order stage is refused.
    expect((await u.call(base, { method: "POST", json: { stage: "decision", data: { text: "x", rationale: "y", confidence: 0.5 } } })).status).toBe(409);
    expect((await u.call(base, { method: "POST", json: { stage: "situation", data: { summary: "A concession decision.", knowns: ["Port loses money"], unknowns: ["Who controls the consortium"], assumptions: [] } } })).status).toBe(200);
    // Hypotheses cannot cite unrevealed evidence.
    expect((await u.call(base, { method: "POST", json: { stage: "hypotheses", data: [{ statement: "a", confidence: 0.5, evidenceIds: ["ev-contract"] }, { statement: "b", confidence: 0.5, evidenceIds: [] }] } })).status).toBe(400);
    expect((await u.call(base, { method: "POST", json: { stage: "hypotheses", data: [{ statement: "The deal is designed to divert cargo", confidence: 0.4, evidenceIds: ["ev-brief"] }, { statement: "The port can be fixed without a concession", confidence: 0.5, evidenceIds: [] }] } })).status).toBe(200);
    for (const actionId of ["ca-consortium", "ca-contract", "ca-benchmark"]) {
      const r = await u.call(base, { method: "POST", json: { stage: "information", actionId } });
      expect(r.status, `${actionId}: ${await r.clone().text()}`).toBe(200);
      view = await r.json();
    }
    expect(view.attempt.data.pointsRemaining).toBe(0);
    expect(view.attempt.stage).toBe("information");
    expect((await u.call(base, { method: "POST", json: { stage: "information", done: true } })).status).toBe(200);
    expect((await u.call(base, { method: "POST", json: { stage: "tree", treeId: null } })).status).toBe(200);
    expect((await u.call(base, { method: "POST", json: { stage: "anticipation", data: [{ actor: "Consortium", response: "Lobbies the PM", probability: 0.8, trigger: "public statement" }, { actor: "Union", response: "Strikes if lay-offs", probability: 0.6 }] } })).status).toBe(200);
    expect((await u.call(base, { method: "POST", json: { stage: "strategy", data: { primary: "Run a competitive process with minimum terms.", fallback: "State-led crane replacement.", assumptions: ["Development bank will lend"], confidence: 0.6 } } })).status).toBe(200);
    const decided = await u.call(base, { method: "POST", json: { stage: "decision", data: { text: "Do not sign the draft; reframe.", rationale: "Ownership and contract clauses.", confidence: 0.7 } } });
    expect(decided.status, await decided.clone().text()).toBe(200);
    view = await decided.json();
    expect(view.attempt.stage).toBe("adversarial");
    expect(view.attempt.data.adversarial.questions.length).toBeGreaterThanOrEqual(2);
    const answers = view.attempt.data.adversarial.questions.map(() => "Because the contract has no volume commitment.");
    const assessed = await u.call(base, { method: "POST", json: { stage: "adversarial", answers } });
    expect(assessed.status, await assessed.clone().text()).toBe(200);
    view = await assessed.json();
    expect(view.attempt.stage).toBe("assessed");
    expect(view.attempt.status).toBe("completed");
    expect(view.attempt.assessment.evidenceCoverage).toBeCloseTo(0.75);
    expect(view.attempt.assessment.previousBest).toBeNull();
    expect(view.referenceAnalysis).toMatch(/structurally dangerous/);
  });

  it("exports all owned data as JSON and sets a request id header", async () => {
    const u = await signUp("archivist@example.test", "Archivist");
    await u.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-locked-archive" } });
    await u.call("/api/v1/reading/documents", { method: "POST", json: { kind: "note", title: "Mine", content: "private text" } });
    const res = await u.call("/api/v1/me/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/lunara-export/);
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
    const data = await res.json();
    expect(data.format).toBe("lunara-strategy-lab/v1");
    expect(data.coaching.sessions).toHaveLength(1);
    expect(data.reading.documents[0].content).toBe("private text");
    expect(data.profile.userId).toBeTruthy();
  });

  it("admin routes require the server-side flag, bootstrapped from ADMIN_EMAILS", async () => {
    const plain = await signUp("plain@example.test", "Plain");
    expect((await plain.call("/api/v1/admin/overview")).status).toBe(403);
    const admin = await signUp("admin@example.test", "Admin");
    const me = await (await admin.call("/api/v1/me")).json();
    expect(me.profile.roles.admin).toBe(true);
    const overview = await admin.call("/api/v1/admin/overview");
    expect(overview.status, await overview.clone().text()).toBe(200);
    const o = await overview.json();
    expect(o.counts.users).toBeGreaterThan(1);
    expect(o.ai.mock).toBe(true);
    expect(JSON.stringify(o)).not.toMatch(/apiKey|secret/i);
    const content = await (await admin.call("/api/v1/admin/content")).json();
    expect(content.ok).toBe(true);
  });

  it("rejects oversized bodies", async () => {
    const u = await signUp("bulk@example.test", "Bulk");
    const res = await u.call("/api/v1/reading/documents", { method: "POST", json: { kind: "text", title: "Big", content: "x".repeat(3 * 1024 * 1024 + 10) } });
    expect(res.status).toBe(413);
  });

  it("reports AI health against the mock provider", async () => {
    const u = await signUp("hal@example.test", "Hal");
    const res = await u.call("/api/v1/ai/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mock).toBe(true);
    expect(body.ok).toBe(true);
  });

  it("deletes the account and everything owned", async () => {
    const u = await signUp("ivy@example.test", "Ivy");
    await u.call("/api/v1/sessions", { method: "POST", json: { exerciseId: "ex-locked-archive" } });
    const del = await u.call("/api/v1/me", { method: "DELETE" });
    expect(del.status).toBe(200);
    const after = await u.call("/api/v1/me");
    expect(after.status).toBe(401);
  });
});
