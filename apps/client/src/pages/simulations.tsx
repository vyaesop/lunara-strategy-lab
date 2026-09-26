import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { SimulationPublic, SimulationSessionView } from "@lunara/schemas";
import { SKILL_DEFINITIONS } from "@lunara/core";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useSimActions, useSimSession, useSimSessions, useSimulations, useStartSimulation } from "@/lib/queries-sim";

const CERTAINTY_TONE = { established: "success", interpretation: "info", disputed: "warning" } as const;

export function SimulationsPage() {
  const sims = useSimulations();
  const sessions = useSimSessions();
  const start = useStartSimulation();
  const navigate = useNavigate();
  const byId = new Map((sessions.data?.sessions ?? []).map((s) => [s.simulationId, s]));
  const [open, setOpen] = useState<SimulationPublic | null>(null);

  const begin = async (id: string) => {
    const v = await start.mutateAsync(id);
    navigate(`/app/simulations/${v.session.id}`);
  };

  return (
    <div>
      <PageTitle eyebrow="Simulations" title="Historical decision points" subtitle="Play a documented decision with the information the actor plausibly had. History is cited; the simulation layer is labelled." />
      {sims.isPending ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sims.data?.simulations.map((s) => {
            const prior = byId.get(s.id);
            return (
              <div key={s.id} className="panel p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">{s.figure}</Badge>
                  <span className="text-xs text-text-faint">{s.period} · {s.estimatedMinutes} min · difficulty {s.difficulty}/5</span>
                </div>
                <h3 className="mt-3 text-xl">{s.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setOpen(open?.id === s.id ? null : s)}>
                    <BookOpen className="h-4 w-4" /> Background and sources
                  </Button>
                  {prior?.status === "active" ? (
                    <Link to={`/app/simulations/${prior.id}`}>
                      <Button size="sm">
                        Resume <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : null}
                  <Button size="sm" variant={prior?.status === "active" ? "secondary" : "primary"} onClick={() => begin(s.id)} loading={start.isPending}>
                    {prior ? "Play again" : "Play"}
                  </Button>
                  {prior?.status === "completed" ? (
                    <Link to={`/app/simulations/${prior.id}`} className="text-sm text-text-muted hover:text-text">
                      Last debrief
                    </Link>
                  ) : null}
                </div>
                {open?.id === s.id ? <Background sim={s} /> : null}
              </div>
            );
          })}
        </div>
      )}
      <ErrorNote error={start.error} />
    </div>
  );
}

function Background({ sim }: { sim: SimulationPublic }) {
  const sources = new Map(sim.sources.map((s) => [s.id, s]));
  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
      <p>{sim.background}</p>
      <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Claims and certainty</div>
      <ul className="mt-1 space-y-1">
        {sim.claims.map((c) => (
          <li key={c.id} className="flex gap-2">
            <Badge tone={CERTAINTY_TONE[c.certainty]}>{c.certainty}</Badge>
            <span>
              {c.text} <span className="text-text-faint">[{c.sourceIds.map((id) => sources.get(id)?.author ?? id).join("; ")}]</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Sources</div>
      <ul className="mt-1 space-y-1 text-xs text-text-muted">
        {sim.sources.map((s) => (
          <li key={s.id}>
            {s.author}, <em>{s.title}</em>{s.publication ? `, ${s.publication}` : ""}{s.year ? ` (${s.year})` : ""} · <Badge>{s.verification.replace(/_/g, " ")}</Badge>
            {s.note ? <span className="text-text-faint"> — {s.note}</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-text-faint">Resource numbers and option effects inside the simulation are a teaching device, not historical claims. Branches that depart from the record are labelled counterfactual.</p>
    </div>
  );
}

export function SimulationPlayPage() {
  const { sessionId = "" } = useParams();
  const q = useSimSession(sessionId);
  const actions = useSimActions(sessionId);
  const [optionId, setOptionId] = useState("");
  const [rationale, setRationale] = useState("");
  const [confidence, setConfidence] = useState(60);

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const view = q.data;
  const { session, simulation, turn } = view;
  const active = session.status === "active";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!turn) return;
    await actions.decide.mutateAsync({ turnId: turn.id, optionId, rationale, confidence: confidence / 100 });
    setOptionId("");
    setRationale("");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/simulations" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
            Simulations
          </Link>
          <h1 className="text-3xl">{simulation.title}</h1>
          <p className="text-sm text-text-muted">{simulation.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={active ? "accent" : "neutral"}>{session.status}</Badge>
          <Badge>Turn {session.decisions.length + (active ? 1 : 0)} of {simulation.difficulty >= 4 ? 3 : 3}</Badge>
          {active ? <Button size="sm" variant="ghost" onClick={() => confirm("Abandon this run?") && actions.abandon.mutate()}>Abandon</Button> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card>
            <ol className="space-y-3">
              {session.log.map((entry, i) => (
                <li key={i} className={cx("rounded-lg p-3 text-sm", entry.kind === "situation" ? "bg-surface-muted" : entry.kind === "counterfactual" ? "border border-warning/40 bg-warning-soft" : "border border-border")}>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-faint">
                    {entry.kind === "situation" ? "Situation" : entry.kind === "counterfactual" ? "Counterfactual branch" : "Consequence"}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </li>
              ))}
            </ol>
          </Card>

          {active && turn ? (
            <Card title={turn.title}>
              {turn.intelligence.length ? (
                <div className="mb-3">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">What you know</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-text-muted">
                    {turn.intelligence.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <form onSubmit={submit} className="space-y-3">
                <div className="space-y-2">
                  {turn.options.map((o) => (
                    <label key={o.id} className={cx("block cursor-pointer rounded-lg border p-3 text-sm", optionId === o.id ? "border-accent bg-accent-soft" : "border-border", !o.available && "opacity-50")}>
                      <input type="radio" name="option" value={o.id} disabled={!o.available} checked={optionId === o.id} onChange={() => setOptionId(o.id)} className="mr-2 accent-[var(--accent)]" />
                      <span className="font-medium">{o.label}</span>
                      <p className="mt-1 text-text-muted">{o.description}</p>
                      {!o.available ? <p className="mt-1 text-xs text-warning">Requires: {o.requires.map((r) => `${r.resource} ${r.op} ${r.value}`).join(", ")}</p> : null}
                    </label>
                  ))}
                </div>
                <div>
                  <Label hint="What are you trying to achieve, what do you expect the other side to do, and what would change your mind?">Rationale</Label>
                  <Textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={3000} />
                </div>
                <div>
                  <Label>Confidence this is the right call: {confidence}%</Label>
                  <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                </div>
                <ErrorNote error={actions.decide.error} />
                <Button type="submit" disabled={!optionId} loading={actions.decide.isPending}>
                  Decide
                </Button>
              </form>
            </Card>
          ) : null}

          {session.status === "completed" ? <SimDebrief view={view} onRetry={() => actions.evaluate.mutate()} retrying={actions.evaluate.isPending} error={actions.evaluate.error} /> : null}
        </div>

        <aside className="space-y-4">
          <Card title="Position">
            <ul className="space-y-2 text-sm">
              {view.resources.map((r) => (
                <li key={r.key} className="flex items-center justify-between">
                  <span>{r.label}</span>
                  {r.value !== null ? <span className="font-mono">{r.value}</span> : <Badge tone={r.band === "high" ? "danger" : r.band === "mid" ? "warning" : "success"}>{r.band} (not visible exactly)</Badge>}
                </li>
              ))}
            </ul>
          </Card>
          {view.revealedEvidence.length ? (
            <Card title="Reports received">
              <ul className="space-y-2 text-sm text-text-muted">
                {view.revealedEvidence.map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {session.decisions.length ? (
            <Card title="Your decisions">
              <ol className="space-y-2 text-sm">
                {session.decisions.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium">{i + 1}.</span> {d.optionId.replace(/^o-/, "").replace(/-/g, " ")} <Badge tone={d.historicalMatch ? "success" : "warning"}>{d.historicalMatch ? "as history" : "counterfactual"}</Badge>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SimDebrief({ view, onRetry, retrying, error }: { view: SimulationSessionView; onRetry: () => void; retrying: boolean; error: unknown }) {
  const ev = view.session.evaluation;
  const record = view.historicalRecord;
  const sources = new Map(view.simulation.sources.map((s) => [s.id, s]));
  return (
    <Card title="Debrief">
      {ev ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Reasoning {Math.round(ev.overallScore * 100)}</Badge>
            <Badge>{ev.historicalMatches}/{ev.turnsPlayed} decisions matched the record</Badge>
            {ev.succeeded !== null ? <Badge tone={ev.succeeded ? "success" : "warning"}>{ev.succeeded ? "Position improved" : "Position worsened"}</Badge> : null}
            <Badge tone="info">{ev.outcomeQuality.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-xs text-text-faint">Matching history is not the score. The rubric judges the reasoning in your rationales; the outcome label separates good reasoning from luck.</p>
          <ul className="space-y-1">
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
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Strengths</div>
              <ul className="list-disc pl-5">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Gaps</div>
              <ul className="list-disc pl-5">{ev.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
          <div className="text-xs text-text-faint">Skill evidence: {ev.skillScores.map((s) => `${SKILL_DEFINITIONS[s.skillId].label} ${Math.round(s.score * 100)}`).join(" · ")}</div>
          <div className="border-t border-border pt-3">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Personal debrief</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{ev.debrief}</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-text-muted">The run is complete but the debrief was not generated.</p>
          <Button className="mt-2" onClick={onRetry} loading={retrying}>
            Generate debrief
          </Button>
          <ErrorNote error={error} />
        </div>
      )}
      {record ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">The historical record</div>
          <p className="mt-1 text-sm">{record.decision}</p>
          <p className="mt-1 text-sm text-text-muted">{record.outcome}</p>
          <p className="mt-1 text-xs text-text-faint">Sources: {record.sourceIds.map((id) => sources.get(id)?.author ?? id).join("; ")}</p>
          <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Scenario debrief</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{record.debrief}</p>
        </div>
      ) : (
        <EmptyState title="Historical record locked" body="The record and debrief open when the run is complete." />
      )}
    </Card>
  );
}
