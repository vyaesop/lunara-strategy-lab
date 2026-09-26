import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import type { DecisionRecord } from "@lunara/schemas";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useJournal, useJournalActions, useProjects } from "@/lib/queries-strategy";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function JournalPage() {
  const journal = useJournal();
  const projects = useProjects();
  const actions = useJournalActions();
  const [params] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const decisions = journal.data?.decisions ?? [];
  const cal = journal.data?.calibration;

  return (
    <div>
      <PageTitle eyebrow="Decision journal" title="Decisions and predictions" subtitle="Record the decision as you saw it at the time. Predictions get resolved later; calibration appears only once there is enough of it." action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "Log a decision"}</Button>} />
      {showForm ? <DecisionForm defaultProjectId={params.get("projectId")} projects={projects.data?.projects ?? []} onDone={() => setShowForm(false)} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {journal.isPending ? <Spinner /> : decisions.length === 0 ? <EmptyState title="No decisions logged" body="Log one before you know how it turns out; that is the point." /> : decisions.map((d) => (
            <DecisionCard key={d.id} d={d} expanded={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} actions={actions} />
          ))}
        </div>
        <Card title="Calibration">
          {cal && cal.enoughData ? (
            <div>
              <div className="font-serif text-3xl">{cal.brier?.toFixed(3)}</div>
              <p className="text-xs text-text-faint">Brier score over {cal.resolvedCount} resolved predictions (0 is perfect, 0.25 is coin-flip at 50%).</p>
              <ul className="mt-3 space-y-1 text-xs">
                {cal.buckets.filter((b) => b.count > 0).map((b) => (
                  <li key={b.lower} className="flex justify-between">
                    <span>{Math.round(b.lower * 100)}–{Math.round(b.upper * 100)}% stated</span>
                    <span>{Math.round(b.observedFrequency * 100)}% happened · n={b.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{cal?.resolvedCount ?? 0} resolved predictions with probabilities. Calibration is shown after 10, so a couple of outcomes cannot masquerade as a trend.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function DecisionCard({ d, expanded, onToggle, actions }: { d: DecisionRecord; expanded: boolean; onToggle: () => void; actions: ReturnType<typeof useJournalActions> }) {
  const [outcome, setOutcome] = useState("");
  const [lessons, setLessons] = useState("");
  const [now] = useState(() => Date.now());
  const dueReview = d.status === "open" && d.reviewAt && new Date(d.reviewAt).getTime() <= now;
  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
        <div>
          <div className="font-medium">{d.title}</div>
          <div className="text-xs text-text-faint">{new Date(d.decidedAt).toLocaleDateString()} · confidence {Math.round(d.confidence * 100)}% · {d.predictions.length} prediction{d.predictions.length === 1 ? "" : "s"}</div>
        </div>
        <span className="flex gap-1">
          {dueReview ? <Badge tone="warning">review due</Badge> : null}
          <Badge tone={d.status === "reviewed" ? "success" : "accent"}>{d.status}</Badge>
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3 text-sm">
          <Field label="Context" text={d.context} />
          <Field label="Objective" text={d.objective} />
          {d.evidence.length ? <Field label="Evidence" text={d.evidence.join("; ")} /> : null}
          {d.alternatives.length ? <div><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Alternatives considered</div><ul className="list-disc pl-5">{d.alternatives.map((a) => <li key={a.text}>{a.text}{a.expectedOutcome ? <span className="text-text-faint"> — expected: {a.expectedOutcome}</span> : null}</li>)}</ul></div> : null}
          <Field label="Chosen action" text={d.chosenAction} />
          <Field label="Rationale" text={d.rationale} />
          {d.risks.length ? <Field label="Risks" text={d.risks.join("; ")} /> : null}
          {d.predictions.length ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Predictions</div>
              <ul className="mt-1 space-y-2">
                {d.predictions.map((p) => (
                  <li key={p.id} className={cx("rounded-lg border p-2", p.resolved === null ? "border-border" : p.resolved ? "border-success/40" : "border-danger/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <span>{p.statement}{p.probability !== null ? <Badge>{Math.round(p.probability * 100)}%</Badge> : null}</span>
                      {p.resolved === null ? (
                        <span className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => actions.resolve.mutate({ id: d.id, predictionId: p.id, resolved: true, resolutionNote: "" })}>Happened</Button>
                          <Button size="sm" variant="secondary" onClick={() => actions.resolve.mutate({ id: d.id, predictionId: p.id, resolved: false, resolutionNote: "" })}>Did not</Button>
                        </span>
                      ) : <Badge tone={p.resolved ? "success" : "danger"}>{p.resolved ? "happened" : "did not"}</Badge>}
                    </div>
                    {p.invalidatingEvidence ? <div className="text-xs text-text-faint">Would be wrong if: {p.invalidatingEvidence}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {d.status === "reviewed" ? (
            <>
              <Field label="What actually happened" text={d.actualOutcome} />
              {d.lessons ? <Field label="Lessons" text={d.lessons} /> : null}
              <p className="text-xs text-text-faint">Reviewed {d.reviewedAt ? new Date(d.reviewedAt).toLocaleDateString() : ""}. A single outcome does not prove the decision right or wrong; compare the reasoning with what you knew at the time.</p>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); actions.review.mutate({ id: d.id, actualOutcome: outcome, lessons }); }} className="space-y-2 rounded-lg bg-surface-muted p-3">
              <Label>Retrospective</Label>
              <Textarea rows={2} required placeholder="What actually happened" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
              <Textarea rows={2} placeholder="Lessons (without hindsight: what was knowable then?)" value={lessons} onChange={(e) => setLessons(e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={actions.review.isPending}>Mark reviewed</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => confirm("Delete this decision?") && actions.remove.mutate(d.id)}>Delete</Button>
              </div>
            </form>
          )}
          {d.projectId ? <Link to={`/app/projects/${d.projectId}`} className="text-xs text-accent">Open project</Link> : null}
        </div>
      ) : null}
    </Card>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">{label}</div>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function DecisionForm({ defaultProjectId, projects, onDone }: { defaultProjectId: string | null; projects: Array<{ id: string; title: string }>; onDone: () => void }) {
  const actions = useJournalActions();
  const [f, setF] = useState({ title: "", context: "", objective: "", evidence: "", alternatives: "", chosenAction: "", rationale: "", risks: "", confidence: 60, projectId: defaultProjectId ?? "", reviewInDays: 30 });
  const [preds, setPreds] = useState<Array<{ statement: string; probability: string; invalidatingEvidence: string }>>([{ statement: "", probability: "", invalidatingEvidence: "" }]);
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const reviewAt = new Date(Date.now() + f.reviewInDays * 86_400_000).toISOString();
    await actions.create.mutateAsync({
      projectId: f.projectId || null,
      title: f.title,
      context: f.context,
      objective: f.objective,
      evidence: lines(f.evidence),
      alternatives: lines(f.alternatives).map((text) => ({ text, expectedOutcome: "" })),
      chosenAction: f.chosenAction,
      rationale: f.rationale,
      risks: lines(f.risks),
      confidence: f.confidence / 100,
      reviewAt,
      predictions: preds.filter((p) => p.statement.trim()).map((p) => ({ statement: p.statement.trim(), probability: p.probability === "" ? null : Math.min(1, Math.max(0, Number(p.probability) / 100)), invalidatingEvidence: p.invalidatingEvidence, reviewAt })),
    });
    onDone();
  };
  return (
    <Card className="mb-4" title="Log a decision">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><Label>Title</Label><Input required value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={280} /></div>
        <div className="md:col-span-2"><Label>Context</Label><Textarea rows={3} required value={f.context} onChange={(e) => set("context", e.target.value)} /></div>
        <div><Label>Objective</Label><Input required value={f.objective} onChange={(e) => set("objective", e.target.value)} maxLength={2000} /></div>
        <div>
          <Label>Project (optional)</Label>
          <select value={f.projectId} onChange={(e) => set("projectId", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div><Label hint="One per line">Evidence available</Label><Textarea rows={3} value={f.evidence} onChange={(e) => set("evidence", e.target.value)} /></div>
        <div><Label hint="One per line">Alternatives considered</Label><Textarea rows={3} value={f.alternatives} onChange={(e) => set("alternatives", e.target.value)} /></div>
        <div className="md:col-span-2"><Label>Chosen action</Label><Input required value={f.chosenAction} onChange={(e) => set("chosenAction", e.target.value)} maxLength={2000} /></div>
        <div className="md:col-span-2"><Label>Rationale</Label><Textarea rows={3} required value={f.rationale} onChange={(e) => set("rationale", e.target.value)} /></div>
        <div><Label hint="One per line">Risks</Label><Textarea rows={2} value={f.risks} onChange={(e) => set("risks", e.target.value)} /></div>
        <div>
          <Label>Confidence: {f.confidence}%</Label>
          <input type="range" min={0} max={100} value={f.confidence} onChange={(e) => set("confidence", Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <Label>Review in {f.reviewInDays} days</Label>
          <input type="range" min={1} max={180} value={f.reviewInDays} onChange={(e) => set("reviewInDays", Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>
        <div className="md:col-span-2">
          <Label hint="Concrete, checkable statements; add a probability for binary ones">Predictions</Label>
          {preds.map((p, i) => (
            <div key={i} className="mb-2 grid gap-1 sm:grid-cols-[1fr_90px_1fr]">
              <Input placeholder="What will happen" value={p.statement} onChange={(e) => setPreds((ps) => ps.map((x, j) => (j === i ? { ...x, statement: e.target.value } : x)))} maxLength={2000} />
              <Input placeholder="%" inputMode="numeric" value={p.probability} onChange={(e) => setPreds((ps) => ps.map((x, j) => (j === i ? { ...x, probability: e.target.value.replace(/[^0-9]/g, "") } : x)))} />
              <Input placeholder="What would prove it wrong" value={p.invalidatingEvidence} onChange={(e) => setPreds((ps) => ps.map((x, j) => (j === i ? { ...x, invalidatingEvidence: e.target.value } : x)))} maxLength={1000} />
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreds((ps) => [...ps, { statement: "", probability: "", invalidatingEvidence: "" }])}>+ prediction</Button>
        </div>
        <div className="md:col-span-2">
          <ErrorNote error={actions.create.error} />
          <Button type="submit" loading={actions.create.isPending}>Save decision</Button>
        </div>
      </form>
    </Card>
  );
}
