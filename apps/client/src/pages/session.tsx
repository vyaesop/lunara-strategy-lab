import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, Lightbulb, Send, Trash2, Unlock } from "lucide-react";
import { Link, useParams } from "react-router";
import { SESSION_PHASES, type SessionPhase } from "@lunara/schemas";
import { AssessmentView } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PHASE_LABELS, Spinner, Textarea, cx } from "@/components/ui";
import { useSession, useSessionActions, type SessionDetail } from "@/lib/queries";

const NEXT_PHASE: Partial<Record<SessionPhase, SessionPhase>> = {
  initial_understanding: "hypothesis",
  hypothesis: "evidence_challenge",
  evidence_challenge: "revision",
  revision: "final_decision",
  debrief: "skill_update",
  skill_update: "completed",
};

export function SessionPage() {
  const { sessionId = "" } = useParams();
  const q = useSession(sessionId);
  const actions = useSessionActions(sessionId);

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { session, exercise, released } = q.data;
  const active = session.status === "active";
  const canHint = active && session.hintLevel < 5 && ["initial_understanding", "hypothesis", "evidence_challenge", "revision", "final_decision"].includes(session.phase);
  const next = NEXT_PHASE[session.phase];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link to={`/app/train/${exercise.id}`} className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
              {exercise.title}
            </Link>
            <PhaseStepper phase={session.phase} />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={active ? "accent" : "neutral"}>{session.status}</Badge>
            {active && session.phase !== "introduction" ? (
              <Button size="sm" variant="ghost" onClick={() => actions.abandon.mutate()} loading={actions.abandon.isPending}>
                Abandon
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="p-0">
          <Transcript data={q.data} />
          {active ? (
            <Composer onSend={(text) => actions.sendMessage.mutateAsync(text)} busy={actions.sendMessage.isPending} error={actions.sendMessage.error} />
          ) : null}
        </Card>

        {released.solution || released.debrief ? (
          <Card className="mt-4" title={released.debrief ? "Debrief" : "Solution"}>
            {released.solution ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">{exercise.answerKind === "fixed" ? "Solution" : "Reference analysis"}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{released.solution}</p>
              </div>
            ) : null}
            {released.keyInsights ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-muted">
                {released.keyInsights.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            ) : null}
            {released.debrief ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Exercise debrief</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{released.debrief}</p>
              </div>
            ) : null}
          </Card>
        ) : null}

        {session.phase === "debrief" || session.phase === "skill_update" || session.status === "completed" ? (
          <Card className="mt-4" title="Your assessment">
            {session.assessment ? (
              <AssessmentView assessment={session.assessment} exercise={exercise} />
            ) : session.status === "active" ? (
              <div>
                <p className="text-sm text-text-muted">
                  The coach will score your reasoning against the exercise rubric, cite your own words as evidence, and record skill evidence in your profile. Hints you used are accounted for separately.
                </p>
                <Button className="mt-3" onClick={() => actions.assess.mutate()} loading={actions.assess.isPending}>
                  Assess my reasoning
                </Button>
                <div className="mt-2">
                  <ErrorNote error={actions.assess.error} />
                </div>
              </div>
            ) : (
              <EmptyState title="No assessment recorded" body="This session ended without an assessment." />
            )}
            {session.assessment && session.status === "active" ? (
              <div className="mt-4 border-t border-border pt-4">
                <Button onClick={() => actions.advance.mutate("completed")} loading={actions.advance.isPending}>
                  Complete session
                </Button>
                <span className="ml-3 text-xs text-text-faint">Marks the session complete and counts toward your streak.</span>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      <aside className="space-y-4">
        <Card title="Scenario">
          <p className="text-sm">{exercise.scenario}</p>
          {exercise.facts.length ? (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Facts</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
                {exercise.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {exercise.constraints.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Constraints</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
                {exercise.constraints.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <Hypotheses data={q.data} actions={actions} />

        {active ? (
          <Card title="Controls">
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-between" disabled={!canHint} onClick={() => actions.hint.mutate()} loading={actions.hint.isPending}>
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" /> Hint {Math.min(5, session.hintLevel + 1)} of 5
                </span>
                <span className="text-xs text-text-faint">{session.hintLevel} used</span>
              </Button>
              {released.hints.length ? (
                <ol className="list-decimal space-y-1 pl-5 text-xs text-text-muted">
                  {released.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
              ) : null}
              {next && session.phase !== "final_decision" && session.phase !== "debrief" && session.phase !== "skill_update" ? (
                <Button variant="secondary" className="w-full justify-between" onClick={() => actions.advance.mutate(next)} loading={actions.advance.isPending}>
                  <span>Move to {PHASE_LABELS[next]}</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
              {!released.solution && session.phase !== "introduction" ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    if (confirm("Reveal the solution now? Your attempt is recorded as assisted.")) actions.reveal.mutate();
                  }}
                  loading={actions.reveal.isPending}
                >
                  <Unlock className="h-4 w-4" /> Reveal solution
                </Button>
              ) : null}
              <ErrorNote error={actions.hint.error ?? actions.advance.error ?? actions.reveal.error} />
            </div>
          </Card>
        ) : null}

        {active && session.phase === "final_decision" ? <DecisionForm actions={actions} /> : null}
        {session.decision ? (
          <Card title="Your decision">
            <p className="text-sm">{session.decision.text}</p>
            <p className="mt-2 text-sm text-text-muted">{session.decision.rationale}</p>
            <div className="mt-2">
              <Badge>Confidence {Math.round(session.decision.confidence * 100)}%</Badge>
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function PhaseStepper({ phase }: { phase: SessionPhase }) {
  const idx = SESSION_PHASES.indexOf(phase);
  return (
    <ol className="mt-1 flex flex-wrap gap-1" aria-label="Session phase">
      {SESSION_PHASES.filter((p) => p !== "completed").map((p, i) => (
        <li key={p} className={cx("rounded-md px-2 py-0.5 text-[11px]", i < idx ? "bg-surface-muted text-text-faint" : i === idx ? "bg-accent-soft text-accent font-medium" : "text-text-faint")}>
          {PHASE_LABELS[p]}
        </li>
      ))}
    </ol>
  );
}

function Transcript({ data }: { data: SessionDetail }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [data.messages.length]);
  return (
    <div ref={ref} className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
      {data.messages.map((m) => (
        <div key={m.id} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cx(
              "prose-coach max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm",
              m.role === "user" ? "bg-accent-soft text-text" : m.role === "coach" ? "bg-surface-muted" : "border border-dashed border-border text-text-faint",
              m.kind === "hint" ? "border border-accent/40" : "",
            )}
          >
            {m.kind === "hint" ? <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Hint</div> : null}
            {m.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function Composer({ onSend, busy, error }: { onSend: (text: string) => Promise<unknown>; busy: boolean; error: unknown }) {
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    await onSend(t);
    setText("");
  };
  return (
    <form onSubmit={submit} className="border-t border-border p-3">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you know for certain, what are you assuming, and what would you need to find out?"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <ErrorNote error={error} />
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          Send <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function Hypotheses({ data, actions }: { data: SessionDetail; actions: ReturnType<typeof useSessionActions> }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [support, setSupport] = useState("");
  const [contra, setContra] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [confidence, setConfidence] = useState(50);
  const canAdd = data.session.status === "active" && ["initial_understanding", "hypothesis", "evidence_challenge", "revision"].includes(data.session.phase);
  const split = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await actions.addHypothesis.mutateAsync({
      statement,
      supportingEvidence: split(support),
      contradictingEvidence: split(contra),
      assumptions: split(assumptions),
      confidence: confidence / 100,
      revisesId: null,
    });
    setStatement("");
    setSupport("");
    setContra("");
    setAssumptions("");
    setConfidence(50);
    setOpen(false);
  };

  return (
    <Card title="Hypotheses" action={canAdd ? <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Add"}</Button> : null}>
      {open ? (
        <form onSubmit={submit} className="mb-3 space-y-2 rounded-lg bg-surface-muted p-3">
          <div>
            <Label>Statement</Label>
            <Textarea rows={2} required value={statement} onChange={(e) => setStatement(e.target.value)} />
          </div>
          <div>
            <Label hint="One per line">Supporting evidence</Label>
            <Textarea rows={2} value={support} onChange={(e) => setSupport(e.target.value)} />
          </div>
          <div>
            <Label hint="One per line">Contradicting evidence</Label>
            <Textarea rows={2} value={contra} onChange={(e) => setContra(e.target.value)} />
          </div>
          <div>
            <Label hint="One per line">Assumptions</Label>
            <Textarea rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
          </div>
          <div>
            <Label>Confidence: {confidence}%</Label>
            <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </div>
          <ErrorNote error={actions.addHypothesis.error} />
          <Button type="submit" size="sm" loading={actions.addHypothesis.isPending}>
            Record hypothesis
          </Button>
        </form>
      ) : null}
      {data.session.hypotheses.length === 0 ? (
        <EmptyState title="None recorded" body="Record at least one before you can move to a decision." />
      ) : (
        <ul className="space-y-2">
          {data.session.hypotheses.map((h) => (
            <li key={h.id} className={cx("rounded-lg border border-border p-3 text-sm", h.status !== "active" && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div>{h.statement}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={h.status === "active" ? "accent" : "neutral"}>{h.status}</Badge>
                    <Badge>{Math.round(h.confidence * 100)}%</Badge>
                  </div>
                </div>
                {h.status === "active" && data.session.status === "active" ? (
                  <button aria-label="Discard hypothesis" className="text-text-faint hover:text-danger" onClick={() => actions.discardHypothesis.mutate(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {h.supportingEvidence.length ? <div className="mt-2 text-xs text-text-muted">For: {h.supportingEvidence.join("; ")}</div> : null}
              {h.contradictingEvidence.length ? <div className="text-xs text-text-muted">Against: {h.contradictingEvidence.join("; ")}</div> : null}
              {h.assumptions.length ? <div className="text-xs text-text-muted">Assumes: {h.assumptions.join("; ")}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DecisionForm({ actions }: { actions: ReturnType<typeof useSessionActions> }) {
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [confidence, setConfidence] = useState(60);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    actions.decide.mutate({ text, rationale, confidence: confidence / 100 });
  };
  return (
    <Card title="Final decision">
      <form onSubmit={submit} className="space-y-2">
        <div>
          <Label>Decision</Label>
          <Input required value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <Label>Rationale</Label>
          <Textarea rows={4} required value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </div>
        <div>
          <Label>Confidence: {confidence}%</Label>
          <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>
        <ErrorNote error={actions.decide.error} />
        <Button type="submit" className="w-full" loading={actions.decide.isPending}>
          Submit decision and open debrief
        </Button>
      </form>
    </Card>
  );
}
