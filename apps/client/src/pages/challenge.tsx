import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CHALLENGE_STAGES, type ChallengeView } from "@lunara/schemas";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useAttempt, useChallengeActions, useChallenges } from "@/lib/queries-game";
import { useTrees } from "@/lib/queries-lab";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const STAGE_LABEL: Record<string, string> = { situation: "Situation", hypotheses: "Hypotheses", information: "Information", tree: "Scenario tree", anticipation: "Anticipation", strategy: "Strategy", decision: "Decision", adversarial: "Adversarial review", assessed: "Assessed" };

export function ChallengesPage() {
  const q = useChallenges();
  const actions = useChallengeActions();
  const navigate = useNavigate();
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  return (
    <div>
      <PageTitle eyebrow="Monthly master challenge" title={`Challenge · ${month}`} subtitle="An unfamiliar problem across every capability, with a time budget and an adversarial review. Results compare with your own previous attempts, never with other people." />
      {q.isPending ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {q.data?.challenges.map((c) => (
            <Card key={c.id} className="lg:col-span-2" title={c.title}>
              <p className="text-sm text-text-muted">{c.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Badge>difficulty {c.difficulty}/5</Badge><Badge>{c.timeBudgetMinutes} min budget</Badge><Badge>{c.budget} investigation points</Badge></div>
              <Button className="mt-4" onClick={async () => navigate(`/app/challenges/${(await actions.start.mutateAsync(c.id)).attempt.id}`)} loading={actions.start.isPending}>Start an attempt</Button>
              <ErrorNote error={actions.start.error} />
            </Card>
          ))}
          <Card title="Your attempts">
            {q.data && q.data.attempts.length ? (
              <ul className="divide-y divide-border text-sm">{q.data.attempts.map((a) => <li key={a.id} className="flex items-center justify-between py-2"><Link to={`/app/challenges/${a.id}`} className="hover:text-accent">{a.monthKey} · {STAGE_LABEL[a.stage]}</Link>{a.overallScore !== null ? <Badge tone="accent">{Math.round(a.overallScore * 100)}</Badge> : <Badge>{a.status}</Badge>}</li>)}</ul>
            ) : <EmptyState title="No attempts yet" />}
          </Card>
        </div>
      )}
    </div>
  );
}

export function ChallengeAttemptPage() {
  const { attemptId = "" } = useParams();
  const q = useAttempt(attemptId);
  const actions = useChallengeActions(attemptId);
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const view = q.data;
  const { attempt, challenge } = view;
  const idx = CHALLENGE_STAGES.indexOf(attempt.stage);
  return (
    <div>
      <div className="mb-4">
        <Link to="/app/challenges" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">Challenge</Link>
        <h1 className="text-2xl">{challenge.title}</h1>
        <ol className="mt-2 flex flex-wrap gap-1">{CHALLENGE_STAGES.map((s, i) => <li key={s} className={cx("rounded-md px-2 py-0.5 text-[11px]", i < idx ? "bg-surface-muted text-text-faint" : i === idx ? "bg-accent-soft text-accent font-medium" : "text-text-faint")}>{STAGE_LABEL[s]}</li>)}</ol>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {attempt.status === "active" ? <StageForm view={view} actions={actions} /> : null}
          {attempt.assessment ? <Assessment view={view} /> : null}
          {attempt.status === "abandoned" ? <EmptyState title="Attempt abandoned" /> : null}
        </div>
        <aside className="space-y-4">
          <Card title="Briefing"><p className="text-sm">{challenge.briefing}</p><ul className="mt-2 list-disc pl-5 text-xs text-text-muted">{challenge.knownFacts.map((f) => <li key={f}>{f}</li>)}</ul></Card>
          <Card title={`Evidence (${view.revealedEvidence.length})`}>
            <ul className="space-y-2 text-sm">{view.revealedEvidence.map((e) => <li key={e.id} className="rounded-lg border border-border p-2"><div className="font-medium">{e.title} <Badge>{e.reliability}</Badge></div><p className="text-xs text-text-muted">{e.content}</p></li>)}</ul>
          </Card>
          {attempt.status === "active" ? <Button variant="ghost" size="sm" onClick={() => confirm("Abandon?") && actions.abandon.mutate()}>Abandon attempt</Button> : null}
        </aside>
      </div>
    </div>
  );
}

function StageForm({ view, actions }: { view: ChallengeView; actions: ReturnType<typeof useChallengeActions> }) {
  const { attempt, challenge } = view;
  const d = attempt.data;
  const trees = useTrees();
  const [text, setText] = useState<Record<string, string>>({});
  const [num, setNum] = useState<Record<string, number>>({});
  const t = (k: string) => text[k] ?? "";
  const setT = (k: string, v: string) => setText((x) => ({ ...x, [k]: v }));
  const busy = actions.submit.isPending;
  const submit = (e: FormEvent, body: Parameters<typeof actions.submit.mutate>[0]) => {
    e.preventDefault();
    actions.submit.mutate(body);
  };
  const err = <ErrorNote error={actions.submit.error} />;

  switch (attempt.stage) {
    case "situation":
      return (
        <Card title="1. Situation">
          <form onSubmit={(e) => submit(e, { stage: "situation", data: { summary: t("summary"), knowns: lines(t("knowns")), unknowns: lines(t("unknowns")), assumptions: lines(t("assumptions")) } })} className="space-y-2">
            <Label>Summarise the situation in your own words</Label><Textarea rows={3} required value={t("summary")} onChange={(e) => setT("summary", e.target.value)} />
            <Label hint="One per line">Knowns</Label><Textarea rows={3} required value={t("knowns")} onChange={(e) => setT("knowns", e.target.value)} />
            <Label hint="One per line, most important first">Unknowns</Label><Textarea rows={3} required value={t("unknowns")} onChange={(e) => setT("unknowns", e.target.value)} />
            <Label hint="One per line">Assumptions you are making</Label><Textarea rows={2} value={t("assumptions")} onChange={(e) => setT("assumptions", e.target.value)} />
            {err}<Button type="submit" loading={busy}>Continue</Button>
          </form>
        </Card>
      );
    case "hypotheses":
      return (
        <Card title="2. Competing hypotheses">
          <form onSubmit={(e) => submit(e, { stage: "hypotheses", data: [0, 1, 2].filter((i) => t(`h${i}`).trim()).map((i) => ({ statement: t(`h${i}`), confidence: (num[`c${i}`] ?? 50) / 100, evidenceIds: [] })) })} className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i}><Label>Hypothesis {i + 1}{i > 1 ? " (optional)" : ""}</Label><Input required={i < 2} value={t(`h${i}`)} onChange={(e) => setT(`h${i}`, e.target.value)} maxLength={2000} /><Label>Confidence {num[`c${i}`] ?? 50}%</Label><input type="range" min={0} max={100} value={num[`c${i}`] ?? 50} onChange={(e) => setNum((x) => ({ ...x, [`c${i}`]: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" /></div>
            ))}
            {err}<Button type="submit" loading={busy}>Continue</Button>
          </form>
        </Card>
      );
    case "information": {
      const taken = new Set(d.actionsTaken.map((a) => a.actionId));
      const revealed = new Set(d.revealedEvidenceIds);
      return (
        <Card title={`3. Gather information · ${d.pointsRemaining}/${challenge.budget} points`}>
          <ul className="space-y-2">{challenge.actions.map((a) => { const locked = a.requiresEvidence.some((id) => !revealed.has(id)); return (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm"><div><div className="font-medium">{a.label}</div><div className="text-xs text-text-muted">{a.description}</div>{locked ? <div className="text-xs text-warning">Needs evidence you have not uncovered.</div> : null}</div><div className="flex flex-col items-end gap-1"><Badge>{a.cost} pts</Badge>{taken.has(a.id) ? <Badge tone="success">done</Badge> : <Button size="sm" variant="secondary" disabled={locked || a.cost > d.pointsRemaining} onClick={() => actions.submit.mutate({ stage: "information", actionId: a.id, done: false })} loading={busy}>Take</Button>}</div></li>
          ); })}</ul>
          {err}<Button className="mt-3" onClick={() => actions.submit.mutate({ stage: "information", done: true })} loading={busy}>Finish gathering</Button>
        </Card>
      );
    }
    case "tree":
      return (
        <Card title="4. Scenario tree">
          <p className="text-sm text-text-muted">Build a tree in the Scenario Trees tool (decision, responses, information action, contingency), then link it here. You may skip, but the rubric rewards it.</p>
          <Link to="/app/trees" className="text-sm text-accent">Open Scenario Trees →</Link>
          <form onSubmit={(e) => submit(e, { stage: "tree", treeId: t("tree") || null })} className="mt-3 space-y-2">
            <select value={t("tree")} onChange={(e) => setT("tree", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"><option value="">No tree</option>{trees.data?.trees.map((tr) => <option key={tr.id} value={tr.id}>{tr.title}</option>)}</select>
            {err}<Button type="submit" loading={busy}>Continue</Button>
          </form>
        </Card>
      );
    case "anticipation":
      return (
        <Card title="5. Anticipate responses">
          <form onSubmit={(e) => submit(e, { stage: "anticipation", data: [0, 1, 2].filter((i) => t(`a${i}`).trim()).map((i) => ({ actor: t(`a${i}`), response: t(`r${i}`), probability: (num[`p${i}`] ?? 50) / 100, trigger: t(`t${i}`) })) })} className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="grid gap-1 sm:grid-cols-3"><Input placeholder="Actor" required={i < 2} value={t(`a${i}`)} onChange={(e) => setT(`a${i}`, e.target.value)} /><Input placeholder="Likely response" required={i < 2} value={t(`r${i}`)} onChange={(e) => setT(`r${i}`, e.target.value)} /><Input placeholder="Trigger you would watch for" value={t(`t${i}`)} onChange={(e) => setT(`t${i}`, e.target.value)} /><div className="sm:col-span-3"><Label>Probability {num[`p${i}`] ?? 50}%</Label><input type="range" min={0} max={100} value={num[`p${i}`] ?? 50} onChange={(e) => setNum((x) => ({ ...x, [`p${i}`]: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" /></div></div>)}
            {err}<Button type="submit" loading={busy}>Continue</Button>
          </form>
        </Card>
      );
    case "strategy":
      return (
        <Card title="6. Primary and fallback strategy">
          <form onSubmit={(e) => submit(e, { stage: "strategy", data: { primary: t("primary"), fallback: t("fallback"), assumptions: lines(t("sassump")), confidence: (num.sconf ?? 60) / 100 } })} className="space-y-2">
            <Label>Primary strategy</Label><Textarea rows={4} required value={t("primary")} onChange={(e) => setT("primary", e.target.value)} />
            <Label>Fallback</Label><Textarea rows={3} required value={t("fallback")} onChange={(e) => setT("fallback", e.target.value)} />
            <Label hint="One per line">Load-bearing assumptions</Label><Textarea rows={2} required value={t("sassump")} onChange={(e) => setT("sassump", e.target.value)} />
            <Label>Confidence {num.sconf ?? 60}%</Label><input type="range" min={0} max={100} value={num.sconf ?? 60} onChange={(e) => setNum((x) => ({ ...x, sconf: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" />
            {err}<Button type="submit" loading={busy}>Continue</Button>
          </form>
        </Card>
      );
    case "decision":
      return (
        <Card title="7. Final decision">
          <form onSubmit={(e) => submit(e, { stage: "decision", data: { text: t("dtext"), rationale: t("drat"), confidence: (num.dconf ?? 60) / 100 } })} className="space-y-2">
            <Label>Decision</Label><Input required value={t("dtext")} onChange={(e) => setT("dtext", e.target.value)} maxLength={2000} />
            <Label>Rationale</Label><Textarea rows={4} required value={t("drat")} onChange={(e) => setT("drat", e.target.value)} />
            <Label>Confidence {num.dconf ?? 60}%</Label><input type="range" min={0} max={100} value={num.dconf ?? 60} onChange={(e) => setNum((x) => ({ ...x, dconf: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" />
            <p className="text-xs text-text-faint">Submitting generates the adversarial reviewer's questions.</p>
            {err}<Button type="submit" loading={busy}>Submit decision</Button>
          </form>
        </Card>
      );
    case "adversarial":
      return (
        <Card title="8. Adversarial review">
          <form onSubmit={(e) => submit(e, { stage: "adversarial", answers: d.adversarial.questions.map((_, i) => t(`ans${i}`)) })} className="space-y-3">
            {d.adversarial.questions.map((qn, i) => <div key={i}><Label>{qn}</Label><Textarea rows={3} required value={t(`ans${i}`)} onChange={(e) => setT(`ans${i}`, e.target.value)} /></div>)}
            {err}<Button type="submit" loading={busy}>Defend and get assessed</Button>
          </form>
        </Card>
      );
    default:
      return null;
  }
}

function Assessment({ view }: { view: ChallengeView }) {
  const a = view.attempt.assessment!;
  return (
    <Card title="Assessment">
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">Overall {Math.round(a.overallScore * 100)}</Badge>
        {a.previousBest !== null ? <Badge tone={a.overallScore >= a.previousBest ? "success" : "warning"}>previous best {Math.round(a.previousBest * 100)}</Badge> : <Badge>first attempt</Badge>}
        <Badge>key evidence {Math.round(a.evidenceCoverage * 100)}%</Badge>
        <Badge tone={a.withinTimeBudget ? "success" : "warning"}>{a.elapsedMinutes} min{a.withinTimeBudget ? "" : " (over budget)"}</Badge>
      </div>
      <p className="mt-1 text-xs text-text-faint">Scores compare with your own previous attempts only. This is an assessment of process on one problem, not a measure of intelligence.</p>
      <ul className="mt-3 space-y-1">{a.criteria.map((c) => <li key={c.criterionId} className="rounded-lg border border-border p-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{c.criterionId}</span><ScoreBar value={c.score} /></div><p className="text-xs text-text-muted">{c.evidence}</p></li>)}</ul>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Strengths</div><ul className="list-disc pl-5">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div><div><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Gaps</div><ul className="list-disc pl-5">{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div></div>
      <div className="mt-3 border-t border-border pt-3"><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Debrief</div><p className="mt-1 whitespace-pre-wrap text-sm">{a.debrief}</p></div>
      {view.referenceAnalysis ? <div className="mt-3 border-t border-border pt-3"><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Reference analysis</div><p className="mt-1 whitespace-pre-wrap text-sm">{view.referenceAnalysis}</p>{view.caseDebrief ? <p className="mt-2 text-sm text-text-muted">{view.caseDebrief}</p> : null}</div> : null}
    </Card>
  );
}
