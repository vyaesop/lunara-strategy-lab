import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Handshake, Send } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { NegotiationSessionView, Proposal } from "@lunara/schemas";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useNegotiationActions, useNegotiationSession, useNegotiationSessions, useNegotiations } from "@/lib/queries-missions";

export function NegotiationsPage() {
  const list = useNegotiations();
  const sessions = useNegotiationSessions();
  const actions = useNegotiationActions();
  const navigate = useNavigate();
  const byId = new Map((sessions.data?.sessions ?? []).map((s) => [s.negotiationId, s]));
  return (
    <div>
      <PageTitle eyebrow="Role-play" title="Negotiations" subtitle="A counterpart with fixed incentives you cannot see. Talk, then put numbers on the table. Acceptance is decided by rules, not by the model's mood." />
      {list.isPending ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data?.negotiations.map((n) => {
            const prior = byId.get(n.id);
            return (
              <div key={n.id} className="panel p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">{n.counterpart.name} · {n.counterpart.role}</Badge>
                  <span className="text-xs text-text-faint">{n.estimatedMinutes} min · {n.maxRounds} rounds</span>
                </div>
                <h3 className="mt-3 text-xl">{n.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{n.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {prior?.status === "active" ? <Link to={`/app/negotiations/${prior.id}`}><Button size="sm">Resume <ArrowRight className="h-4 w-4" /></Button></Link> : null}
                  <Button size="sm" variant={prior?.status === "active" ? "secondary" : "primary"} onClick={async () => navigate(`/app/negotiations/${(await actions.start.mutateAsync(n.id)).session.id}`)} loading={actions.start.isPending}>
                    {prior ? "New session" : "Start"}
                  </Button>
                  {prior?.status === "completed" ? <Link to={`/app/negotiations/${prior.id}`} className="text-sm text-text-muted hover:text-text">Last debrief</Link> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ErrorNote error={actions.start.error} />
    </div>
  );
}

export function NegotiationPage() {
  const { sessionId = "" } = useParams();
  const q = useNegotiationSession(sessionId);
  const actions = useNegotiationActions(sessionId);
  const [text, setText] = useState("");
  const [terms, setTerms] = useState<Proposal>({});
  const [prep, setPrep] = useState<{ interests: string; batna: string; plan: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [q.data?.session.messages.length]);
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const view = q.data;
  const { session, negotiation, currentOffer } = view;
  const active = session.status === "active";
  const p = prep ?? { interests: session.preparation.interests, batna: session.preparation.batna, plan: session.preparation.plan };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await actions.say.mutateAsync(text.trim());
    setText("");
  };
  const propose = async (e: FormEvent) => {
    e.preventDefault();
    await actions.propose.mutateAsync({ terms, message: text.trim() });
    setText("");
  };
  const termsComplete = negotiation.issues.every((i) => typeof terms[i.key] === "number" && !Number.isNaN(terms[i.key]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/app/negotiations" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">Negotiations</Link>
          <h1 className="text-2xl">{negotiation.title}</h1>
          <p className="text-sm text-text-muted">{negotiation.userRole} Counterpart: {negotiation.counterpart.name}, {negotiation.counterpart.role}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={active ? "accent" : "neutral"}>{session.status}</Badge>
          <Badge>Round {session.round}/{negotiation.maxRounds}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-0">
            <div ref={logRef} data-lenis-prevent className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
              {session.messages.map((m) => (
                <div key={m.id} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm", m.role === "user" ? "bg-accent-soft" : m.role === "counterpart" ? "bg-surface-muted" : "border border-dashed border-border text-text-faint")}>
                    {m.role === "counterpart" ? <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-faint">{negotiation.counterpart.name}</div> : null}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            {active ? (
              <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something (probe interests, frame, respond)" />
                <Button type="submit" loading={actions.say.isPending} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
              </form>
            ) : null}
            <ErrorNote error={actions.say.error} />
          </Card>

          {active ? (
            <Card title="Put a proposal on the table">
              <form onSubmit={propose} className="grid gap-3 sm:grid-cols-2">
                {negotiation.issues.map((i) => (
                  <div key={i.key}>
                    <Label hint={`${i.min}–${i.max}${i.unit ? " " + i.unit : ""}${i.userPrefersHigh ? " · higher is better for you" : " · lower is better for you"}`}>{i.label}</Label>
                    {i.max - i.min <= 1 && i.step === 1 ? (
                      <select value={terms[i.key] ?? ""} onChange={(e) => setTerms((t) => ({ ...t, [i.key]: Number(e.target.value) }))} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                        <option value="">—</option>
                        <option value={0}>No</option>
                        <option value={1}>Yes</option>
                      </select>
                    ) : (
                      <Input type="number" min={i.min} max={i.max} step={i.step} value={terms[i.key] ?? ""} onChange={(e) => setTerms((t) => ({ ...t, [i.key]: e.target.value === "" ? NaN : Number(e.target.value) }))} />
                    )}
                  </div>
                ))}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={!termsComplete} loading={actions.propose.isPending}><Handshake className="h-4 w-4" /> Propose</Button>
                  {currentOffer ? <Button type="button" variant="secondary" onClick={() => confirm("Accept the counterpart's current offer?") && actions.accept.mutate()} loading={actions.accept.isPending}>Accept their offer</Button> : null}
                  <Button type="button" variant="ghost" onClick={() => confirm("Walk away with no deal?") && actions.walkAway.mutate()}>Walk away</Button>
                </div>
                <div className="sm:col-span-2"><ErrorNote error={actions.propose.error ?? actions.accept.error} /></div>
              </form>
            </Card>
          ) : (
            <NegotiationDebrief view={view} onEvaluate={() => actions.evaluate.mutate()} busy={actions.evaluate.isPending} error={actions.evaluate.error} />
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Briefing">
            <p className="text-sm">{negotiation.briefing}</p>
            <p className="mt-2 text-xs text-text-muted"><span className="font-medium">Your guidance:</span> {negotiation.userGuidance}</p>
            <p className="mt-2 text-xs text-text-faint">{negotiation.counterpart.publicDescription}</p>
          </Card>
          {currentOffer ? (
            <Card title="Their current offer">
              <ul className="text-sm">{negotiation.issues.map((i) => <li key={i.key} className="flex justify-between"><span>{i.label}</span><span className="font-mono">{i.max - i.min <= 1 && i.step === 1 ? (currentOffer[i.key] ? "Yes" : "No") : `${currentOffer[i.key]}${i.unit ? " " + i.unit : ""}`}</span></li>)}</ul>
            </Card>
          ) : null}
          <Card title="Your preparation (private)">
            <div className="space-y-2">
              <Textarea rows={2} placeholder="Interests: what do you and they actually need?" value={p.interests} onChange={(e) => setPrep({ ...p, interests: e.target.value })} disabled={!active} />
              <Textarea rows={2} placeholder="Your alternative if there is no deal" value={p.batna} onChange={(e) => setPrep({ ...p, batna: e.target.value })} disabled={!active} />
              <Textarea rows={2} placeholder="Concession plan: what you give first, what you want back" value={p.plan} onChange={(e) => setPrep({ ...p, plan: e.target.value })} disabled={!active} />
              {active ? <Button size="sm" variant="secondary" disabled={prep === null} onClick={() => actions.prepare.mutate(p, { onSuccess: () => setPrep(null) })} loading={actions.prepare.isPending}>Save preparation</Button> : null}
            </div>
          </Card>
          {session.proposals.length ? (
            <Card title="Proposal history">
              <ol className="space-y-1 text-xs">
                {session.proposals.map((pr, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>R{pr.round} · {pr.by === "user" ? "you" : negotiation.counterpart.name.split(" ")[0]}: {negotiation.issues.map((is) => `${is.label.split(" ")[0]} ${pr.terms[is.key]}`).join(", ")}</span>
                    {pr.response ? <Badge tone={pr.response === "accepted" ? "success" : pr.response === "countered" ? "warning" : "danger"}>{pr.response}</Badge> : null}
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

function NegotiationDebrief({ view, onEvaluate, busy, error }: { view: NegotiationSessionView; onEvaluate: () => void; busy: boolean; error: unknown }) {
  const { session, negotiation } = view;
  const ev = session.evaluation;
  return (
    <Card title="Debrief">
      <div className="flex flex-wrap gap-2">
        <Badge tone={session.outcome?.dealReached ? "success" : "warning"}>{session.outcome?.dealReached ? "Deal reached" : "No deal"}</Badge>
        {session.outcome?.terms ? <Badge>{negotiation.issues.map((i) => `${i.label}: ${session.outcome!.terms![i.key]}`).join(" · ")}</Badge> : null}
      </div>
      {ev ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Process {Math.round(ev.overallScore * 100)}</Badge>
            {ev.userValue !== null ? <Badge>Deal value vs reference {Math.round(ev.userValue * 100)}%</Badge> : null}
            {ev.counterpartUtility !== null ? <Badge>Their satisfaction {Math.round(ev.counterpartUtility * 100)}%</Badge> : null}
            <Badge>{ev.roundsUsed} rounds</Badge>
          </div>
          <ul className="space-y-1">
            {ev.criteria.map((c) => (
              <li key={c.criterionId} className="rounded-lg border border-border p-2 text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{c.criterionId.replace(/_/g, " ")}</span><ScoreBar value={c.score} /></div>
                <p className="text-xs text-text-muted">{c.evidence}</p>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Strengths</div><ul className="list-disc pl-5">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
            <div><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Gaps</div><ul className="list-disc pl-5">{ev.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
          </div>
          <div className="border-t border-border pt-3"><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Debrief</div><p className="mt-1 whitespace-pre-wrap text-sm">{ev.debrief}</p></div>
          <div className="border-t border-border pt-3"><div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">The counterpart's simulated incentives</div><p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{ev.counterpartIncentives}</p><p className="mt-1 text-xs text-text-faint">This describes a fictional persona's rules, not any real person.</p></div>
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState title="Ready for the debrief" body="Scores the process against the rubric and reveals the counterpart's incentives." action={<Button onClick={onEvaluate} loading={busy}>Generate debrief</Button>} />
          <ErrorNote error={error} />
        </div>
      )}
    </Card>
  );
}
