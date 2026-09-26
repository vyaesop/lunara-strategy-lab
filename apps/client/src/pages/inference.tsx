import { useState, type FormEvent } from "react";
import { ArrowRight, Coins, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { EvidenceItem, EvidenceLink, InvestigationHypothesis, InvestigationSessionView, UpsertInvestigationHypothesisRequest } from "@lunara/schemas";
import { SKILL_DEFINITIONS } from "@lunara/core";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useInvestigationActions, useInvestigationSession, useInvestigationSessions, useInvestigations, useStartInvestigation } from "@/lib/queries-lab";

const KIND_LABEL: Record<EvidenceItem["kind"], string> = { document: "Document", testimony: "Testimony", observation: "Observation", report: "Report", physical: "Physical" };
const RELIABILITY_TONE: Record<EvidenceItem["reliability"], "success" | "warning" | "danger"> = { high: "success", medium: "warning", low: "danger" };

export function InferenceLabPage() {
  const investigations = useInvestigations();
  const sessions = useInvestigationSessions();
  const start = useStartInvestigation();
  const navigate = useNavigate();
  const bySlug = new Map((sessions.data?.sessions ?? []).map((s) => [s.investigationId, s]));

  const begin = async (id: string) => {
    const view = await start.mutateAsync(id);
    navigate(`/app/inference/${view.session.id}`);
  };

  return (
    <div>
      <PageTitle eyebrow="Inference Lab" title="Investigations" subtitle="Uncover evidence with a limited budget, keep competing hypotheses alive, and conclude only what the evidence supports." />
      {investigations.isPending ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {investigations.data?.investigations.map((inv) => {
            const prior = bySlug.get(inv.id);
            return (
              <div key={inv.id} className="panel p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">{inv.kind === "fictional" ? "Fictional case, answer key" : "Real-world, open"}</Badge>
                  <span className="text-xs text-text-faint">{inv.estimatedMinutes} min · difficulty {inv.difficulty}/5 · {inv.budget} points</span>
                </div>
                <h3 className="mt-3 text-xl">{inv.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{inv.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {prior?.status === "active" ? (
                    <Link to={`/app/inference/${prior.id}`}>
                      <Button size="sm">
                        Resume <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : null}
                  <Button size="sm" variant={prior?.status === "active" ? "secondary" : "primary"} onClick={() => begin(inv.id)} loading={start.isPending}>
                    {prior ? "New attempt" : "Open case"}
                  </Button>
                  {prior?.status === "completed" ? (
                    <Link to={`/app/inference/${prior.id}`} className="text-sm text-text-muted hover:text-text">
                      View last evaluation
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ErrorNote error={start.error} />
    </div>
  );
}

export function InvestigationPage() {
  const { sessionId = "" } = useParams();
  const q = useInvestigationSession(sessionId);
  const actions = useInvestigationActions(sessionId);
  const [tab, setTab] = useState<"evidence" | "hypotheses" | "actions">("evidence");

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const view = q.data;
  const { session, investigation } = view;
  const active = session.status === "active";
  const evidenceById = new Map(view.revealedEvidence.map((e) => [e.id, e]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/inference" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
            Inference Lab
          </Link>
          <h1 className="text-3xl">{investigation.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">
            <Coins className="mr-1 h-3 w-3" /> {session.pointsRemaining}/{investigation.budget} points
          </Badge>
          <Badge tone={active ? "info" : "neutral"}>{session.status}</Badge>
          {active ? (
            <Button size="sm" variant="ghost" onClick={() => confirm("Abandon this investigation?") && actions.abandon.mutate()}>
              Abandon
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="mb-4">
        <p className="text-sm">{investigation.briefing}</p>
        {investigation.knownFacts.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-text-muted">
            {investigation.knownFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {session.evaluation ? <EvaluationCard view={view} /> : session.conclusion && !session.evaluation ? (
        <Card className="mb-4" title="Evaluation pending">
          <p className="text-sm text-text-muted">Your conclusion is saved but the evaluation was not generated. Try again.</p>
          <Button className="mt-2" onClick={() => actions.evaluate.mutate()} loading={actions.evaluate.isPending}>
            Evaluate now
          </Button>
          <ErrorNote error={actions.evaluate.error} />
        </Card>
      ) : null}

      <div className="mb-3 flex gap-1 lg:hidden">
        {(["evidence", "hypotheses", "actions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("rounded-lg px-3 py-1.5 text-sm capitalize", tab === t ? "bg-accent-soft text-accent font-medium" : "text-text-muted")}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cx(tab !== "evidence" && "hidden lg:block")}>
          <EvidenceBoard evidence={view.revealedEvidence} entities={investigation.entities} />
        </div>
        <div className={cx(tab !== "hypotheses" && "hidden lg:block")}>
          <HypothesisWorkspace view={view} actions={actions} evidenceById={evidenceById} />
        </div>
        <div className={cx("space-y-4", tab !== "actions" && "hidden lg:block")}>
          <ActionsPanel view={view} actions={actions} />
          {active ? <ConcludeCard view={view} actions={actions} /> : null}
        </div>
      </div>
    </div>
  );
}

function EvidenceBoard({ evidence, entities }: { evidence: EvidenceItem[]; entities: InvestigationSessionView["investigation"]["entities"] }) {
  return (
    <Card title="Evidence board">
      <ul className="space-y-2">
        {evidence.map((e) => (
          <li key={e.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-sm font-medium">{e.title}</span>
              <span className="flex gap-1">
                <Badge>{KIND_LABEL[e.kind]}</Badge>
                <Badge tone={RELIABILITY_TONE[e.reliability]}>{e.reliability} reliability</Badge>
              </span>
            </div>
            <p className="mt-1 text-sm text-text-muted">{e.content}</p>
            <div className="mt-1 text-xs text-text-faint">Source: {e.source}</div>
          </li>
        ))}
      </ul>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-text-faint">People and explanations</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {entities.map((en) => (
            <li key={en.id}>
              <span className="font-medium">{en.name}</span> <span className="text-text-faint">({en.role})</span>
              {en.candidate ? <Badge tone="info">candidate</Badge> : null}
              <div className="text-xs text-text-muted">{en.description}</div>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function HypothesisWorkspace({ view, actions, evidenceById }: { view: InvestigationSessionView; actions: ReturnType<typeof useInvestigationActions>; evidenceById: Map<string, EvidenceItem> }) {
  const [editing, setEditing] = useState<InvestigationHypothesis | "new" | null>(null);
  const active = view.session.status === "active";
  const hyps = view.session.hypotheses;

  return (
    <Card title="Hypotheses" action={active && editing === null ? <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>Add</Button> : null}>
      {editing !== null ? (
        <HypothesisForm
          view={view}
          existing={editing === "new" ? null : editing}
          busy={actions.addHypothesis.isPending || actions.updateHypothesis.isPending}
          error={actions.addHypothesis.error ?? actions.updateHypothesis.error}
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            if (editing === "new") await actions.addHypothesis.mutateAsync(body);
            else await actions.updateHypothesis.mutateAsync({ id: editing.id, patch: body });
            setEditing(null);
          }}
        />
      ) : null}
      {hyps.length === 0 && editing === null ? (
        <EmptyState title="No hypotheses yet" body="Record at least two competing explanations. Link each to the evidence that supports or contradicts it." />
      ) : (
        <ul className="mt-3 space-y-2">
          {hyps.map((h) => {
            const entity = view.investigation.entities.find((e) => e.id === h.answerEntityId);
            return (
              <li key={h.id} className={cx("rounded-lg border border-border p-3 text-sm", h.status !== "active" && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{h.statement}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entity ? <Badge tone="info">{entity.name}</Badge> : null}
                      <Badge tone={h.status === "active" ? "accent" : "neutral"}>{h.status}</Badge>
                      <Badge>{Math.round(h.confidence * 100)}%</Badge>
                    </div>
                  </div>
                  {active && h.status === "active" ? (
                    <span className="flex gap-1">
                      <button aria-label="Edit" className="text-text-faint hover:text-text" onClick={() => setEditing(h)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button aria-label="Discard" className="text-text-faint hover:text-danger" onClick={() => actions.discardHypothesis.mutate(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  ) : null}
                </div>
                {h.links.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {h.links.map((l) => (
                      <li key={l.evidenceId} className={cx(l.relation === "supports" ? "text-success" : l.relation === "contradicts" ? "text-danger" : "text-text-muted")}>
                        {l.relation} ({l.weight}) · {evidenceById.get(l.evidenceId)?.title ?? l.evidenceId}
                        {l.note ? <span className="text-text-faint"> — {l.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-xs text-warning">No evidence linked.</div>
                )}
                {h.assumptions.length ? <div className="mt-1 text-xs text-text-muted">Assumes: {h.assumptions.join("; ")}</div> : null}
                {h.distinguishingTest ? <div className="mt-1 text-xs text-text-muted">Would distinguish: {h.distinguishingTest}</div> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function HypothesisForm({ view, existing, busy, error, onCancel, onSubmit }: { view: InvestigationSessionView; existing: InvestigationHypothesis | null; busy: boolean; error: unknown; onCancel: () => void; onSubmit: (b: UpsertInvestigationHypothesisRequest) => Promise<void> }) {
  const [statement, setStatement] = useState(existing?.statement ?? "");
  const [entity, setEntity] = useState<string>(existing?.answerEntityId ?? "");
  const [links, setLinks] = useState<Record<string, EvidenceLink>>(Object.fromEntries((existing?.links ?? []).map((l) => [l.evidenceId, l])));
  const [assumptions, setAssumptions] = useState((existing?.assumptions ?? []).join("\n"));
  const [distinguishing, setDistinguishing] = useState(existing?.distinguishingTest ?? "");
  const [confidence, setConfidence] = useState(Math.round((existing?.confidence ?? 0.5) * 100));

  const setRelation = (evidenceId: string, relation: EvidenceLink["relation"] | "") => {
    setLinks((prev) => {
      const next = { ...prev };
      if (!relation) delete next[evidenceId];
      else next[evidenceId] = { evidenceId, relation, weight: prev[evidenceId]?.weight ?? 2, ...(prev[evidenceId]?.note ? { note: prev[evidenceId]!.note } : {}) };
      return next;
    });
  };
  const setWeight = (evidenceId: string, weight: number) => setLinks((prev) => (prev[evidenceId] ? { ...prev, [evidenceId]: { ...prev[evidenceId]!, weight } } : prev));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      statement,
      answerEntityId: entity || null,
      links: Object.values(links),
      assumptions: assumptions.split("\n").map((s) => s.trim()).filter(Boolean),
      ...(distinguishing.trim() ? { distinguishingTest: distinguishing.trim() } : {}),
      confidence: confidence / 100,
      revisesId: null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-surface-muted p-3">
      <div>
        <Label>Hypothesis</Label>
        <Textarea rows={2} required value={statement} onChange={(e) => setStatement(e.target.value)} />
      </div>
      <div>
        <Label hint="Which candidate does this hypothesis name?">Answer</Label>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
          <option value="">Not yet</option>
          {view.investigation.entities.filter((en) => en.candidate).map((en) => (
            <option key={en.id} value={en.id}>
              {en.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label hint="Link the evidence you have uncovered">Evidence links</Label>
        <ul className="space-y-1">
          {view.revealedEvidence.map((ev) => {
            const l = links[ev.id];
            return (
              <li key={ev.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{ev.title}</span>
                <select value={l?.relation ?? ""} onChange={(e) => setRelation(ev.id, e.target.value as EvidenceLink["relation"] | "")} className="h-7 rounded border border-border bg-bg-elevated px-1">
                  <option value="">—</option>
                  <option value="supports">supports</option>
                  <option value="contradicts">contradicts</option>
                  <option value="neutral">neutral</option>
                </select>
                {l ? (
                  <select value={l.weight} onChange={(e) => setWeight(ev.id, Number(e.target.value))} className="h-7 rounded border border-border bg-bg-elevated px-1" aria-label="weight">
                    <option value={1}>weak</option>
                    <option value={2}>moderate</option>
                    <option value={3}>strong</option>
                  </select>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Label hint="One per line">Assumptions</Label>
        <Textarea rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
      </div>
      <div>
        <Label hint="What evidence would separate this from its rivals?">Distinguishing test</Label>
        <Input value={distinguishing} onChange={(e) => setDistinguishing(e.target.value)} maxLength={500} />
      </div>
      <div>
        <Label>Confidence: {confidence}%</Label>
        <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>
          {existing ? "Save changes" : "Record hypothesis"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ActionsPanel({ view, actions }: { view: InvestigationSessionView; actions: ReturnType<typeof useInvestigationActions> }) {
  const { session, investigation } = view;
  const taken = new Set(session.actionsTaken.map((a) => a.actionId));
  const revealed = new Set(session.revealedEvidenceIds);
  const active = session.status === "active";
  return (
    <Card title="Investigative actions">
      <ul className="space-y-2">
        {investigation.actions.map((a) => {
          const done = taken.has(a.id);
          const locked = a.requiresEvidence.some((id) => !revealed.has(id));
          const unaffordable = a.cost > session.pointsRemaining;
          return (
            <li key={a.id} className={cx("rounded-lg border border-border p-3 text-sm", done && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-text-muted">{a.description}</div>
                  {locked ? <div className="mt-1 text-xs text-warning">Requires evidence you have not uncovered yet.</div> : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge>{a.cost} pt{a.cost === 1 ? "" : "s"}</Badge>
                  {done ? (
                    <Badge tone="success">done</Badge>
                  ) : active ? (
                    <Button size="sm" variant="secondary" disabled={locked || unaffordable} onClick={() => actions.act.mutate(a.id)} loading={actions.act.isPending && actions.act.variables === a.id}>
                      Take
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <ErrorNote error={actions.act.error} />
      {active ? (
        <div className="mt-3 border-t border-border pt-3">
          <Button variant="secondary" size="sm" className="w-full justify-between" disabled={session.hintLevel >= 5} onClick={() => actions.hint.mutate()} loading={actions.hint.isPending}>
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Hint {Math.min(5, session.hintLevel + 1)} of 5
            </span>
          </Button>
          <ErrorNote error={actions.hint.error} />
        </div>
      ) : null}
      {view.hints.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-text-muted">
          {view.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}

function ConcludeCard({ view, actions }: { view: InvestigationSessionView; actions: ReturnType<typeof useInvestigationActions> }) {
  const activeHyps = view.session.hypotheses.filter((h) => h.status === "active");
  const [hypothesisId, setHypothesisId] = useState("");
  const [rationale, setRationale] = useState("");
  const [confidence, setConfidence] = useState(60);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!confirm("Conclude the investigation? Unused points are forfeited and the evaluation is final.")) return;
    actions.conclude.mutate({ hypothesisId, rationale, confidence: confidence / 100 });
  };
  return (
    <Card title="Conclude">
      {activeHyps.length === 0 ? (
        <p className="text-sm text-text-muted">Record at least one hypothesis to conclude.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <select required value={hypothesisId} onChange={(e) => setHypothesisId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
            <option value="">Choose the hypothesis you conclude with</option>
            {activeHyps.map((h) => (
              <option key={h.id} value={h.id}>
                {h.statement.slice(0, 80)}
              </option>
            ))}
          </select>
          <Textarea rows={4} required placeholder="Rationale: which evidence carries the conclusion, and what remains uncertain?" value={rationale} onChange={(e) => setRationale(e.target.value)} />
          <div>
            <Label>Confidence: {confidence}%</Label>
            <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </div>
          <ErrorNote error={actions.conclude.error} />
          <Button type="submit" className="w-full" loading={actions.conclude.isPending}>
            Submit conclusion
          </Button>
        </form>
      )}
    </Card>
  );
}

function EvaluationCard({ view }: { view: InvestigationSessionView }) {
  const ev = view.session.evaluation!;
  const truth = view.groundTruth;
  const answer = truth?.answerEntityId ? view.investigation.entities.find((e) => e.id === truth.answerEntityId)?.name : null;
  return (
    <Card className="mb-4" title="Evaluation">
      <div className="flex flex-wrap gap-2">
        {ev.correct === null ? <Badge>Open case</Badge> : <Badge tone={ev.correct ? "success" : "danger"}>{ev.correct ? "Conclusion matches the ground truth" : "Conclusion does not match the ground truth"}</Badge>}
        <Badge tone="accent">Reasoning {Math.round(ev.overallScore * 100)}</Badge>
        <Badge>Stated confidence {Math.round(ev.calibration.statedConfidence * 100)}%</Badge>
        <Badge>{ev.pointsUsed}/{ev.budget} points</Badge>
        <Badge>{ev.hintLevelUsed} hints</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Metric label="Key evidence covered" value={ev.evidenceCoverage} hint="Key evidence you uncovered and linked to your conclusion." />
        <Metric label="Contradiction awareness" value={ev.contradictionAwareness} hint="Of the key evidence you linked, how much you read in the direction the truth implies." />
        <div className="rounded-lg bg-surface-muted p-3">
          <div className="text-xs text-text-muted">Misled by</div>
          <div className="mt-1 font-serif text-2xl">{ev.misledByCount}</div>
          <div className="text-xs text-text-faint">Misleading items linked as strong support · {ev.competingHypotheses} hypotheses kept</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Rubric</div>
        <ul className="mt-1 space-y-1">
          {ev.criteria.map((c) => (
            <li key={c.criterionId} className="rounded-lg border border-border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.criterionId.replace(/_/g, " ")}</span>
                <ScoreBar value={c.score} />
              </div>
              <p className="text-xs text-text-muted">{c.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Strengths</div>
          <ul className="list-disc pl-5">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Gaps</div>
          <ul className="list-disc pl-5">{ev.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>
      <div className="mt-3 text-xs text-text-faint">Skill evidence: {ev.skillScores.map((s) => `${SKILL_DEFINITIONS[s.skillId].label} ${Math.round(s.score * 100)}`).join(" · ")}</div>
      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Personal debrief</div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{ev.debrief}</p>
      </div>
      {truth ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">What actually happened{answer ? `: ${answer}` : ""}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{truth.summary}</p>
          <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Case debrief</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{truth.debrief}</p>
        </div>
      ) : null}
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 font-serif text-2xl">{Math.round(value * 100)}%</div>
      <div className="text-xs text-text-faint">{hint}</div>
    </div>
  );
}
