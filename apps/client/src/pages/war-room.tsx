import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { COUNCIL_ROLES, type CouncilRole, type CouncilSession } from "@lunara/schemas";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useTrees } from "@/lib/queries-lab";
import { useCouncil, useCouncilActions, useCouncils } from "@/lib/queries-sim";

const ROLE_META: Record<CouncilRole, { label: string; angle: string }> = {
  strategist: { label: "Strategist", angle: "objectives, sequencing, leverage" },
  skeptic: { label: "Skeptic", angle: "assumptions, evidence, overconfidence" },
  opponent: { label: "Opponent", angle: "counter-moves, incentives, vulnerabilities" },
  operator: { label: "Operator", angle: "feasibility, dependencies, execution" },
  auditor: { label: "Auditor", angle: "facts, uncertainty, consistency" },
};

export function WarRoomPage() {
  const councils = useCouncils();
  const trees = useTrees();
  const actions = useCouncilActions();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [roles, setRoles] = useState<CouncilRole[]>([...COUNCIL_ROLES]);
  const [depth, setDepth] = useState<"concise" | "detailed">("concise");
  const [treeId, setTreeId] = useState("");

  const convene = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.convene.mutateAsync({ title, brief, roles, depth, treeId: treeId || null });
    navigate(`/app/war-room/${r.council.id}`);
  };

  return (
    <div>
      <PageTitle eyebrow="War Room" title="Council" subtitle="Five roles analyse your plan independently and argue with each other. They do not vote. You decide, and the record keeps your reasoning." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Bring a problem">
          <form onSubmit={convene} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label hint="Situation, objective, your current plan, what you are unsure about">Brief</Label>
              <Textarea rows={7} required value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={12000} />
            </div>
            <div>
              <Label hint="Disable roles to save cost and time">Roles</Label>
              <div className="flex flex-wrap gap-2">
                {COUNCIL_ROLES.map((r) => (
                  <button key={r} type="button" aria-pressed={roles.includes(r)} onClick={() => setRoles((l) => (l.includes(r) ? (l.length > 1 ? l.filter((x) => x !== r) : l) : [...l, r]))} className={cx("rounded-full border px-3 py-1.5 text-sm", roles.includes(r) ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted")}>
                    {ROLE_META[r].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label hint={depth === "concise" ? "Fewer points, faster, cheaper" : "Up to 12 points per role"}>Depth</Label>
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  {(["concise", "detailed"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDepth(d)} className={cx("rounded-md px-3 py-1.5 text-sm capitalize", depth === d ? "bg-accent-soft text-accent font-medium" : "text-text-muted")}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label hint="Optional: include a scenario tree">Tree</Label>
                <select value={treeId} onChange={(e) => setTreeId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                  <option value="">None</option>
                  {trees.data?.trees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-text-faint">Estimated calls: {roles.length * (roles.length > 1 ? 2 : 1)} (one analysis per role plus one cross-critique per role). Your brief is sent only to providers approved for private content.</p>
            <ErrorNote error={actions.convene.error} />
            <Button type="submit" loading={actions.convene.isPending}>
              Convene council
            </Button>
          </form>
        </Card>
        <Card title="Past councils">
          {councils.isPending ? (
            <Spinner />
          ) : councils.data && councils.data.councils.length ? (
            <ul className="divide-y divide-border text-sm">
              {councils.data.councils.map((c) => (
                <li key={c.id} className="py-2">
                  <Link to={`/app/war-room/${c.id}`} className="hover:text-accent">
                    {c.title}
                  </Link>
                  <div className="text-xs text-text-faint">
                    {c.status} · {c.roles.length} roles · {new Date(c.updatedAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No councils yet" />
          )}
        </Card>
      </div>
    </div>
  );
}

export function CouncilPage() {
  const { councilId = "" } = useParams();
  const q = useCouncil(councilId);
  const actions = useCouncilActions(councilId);
  const [askRole, setAskRole] = useState<CouncilRole | "">("");
  const [question, setQuestion] = useState("");
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const c = q.data.council;

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!askRole) return;
    await actions.ask.mutateAsync({ role: askRole, question });
    setQuestion("");
  };

  return (
    <div>
      <div className="mb-4">
        <Link to="/app/war-room" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
          War Room
        </Link>
        <h1 className="text-3xl">{c.title}</h1>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge tone={c.status === "open" ? "accent" : c.status === "decided" ? "success" : "neutral"}>{c.status}</Badge>
          <Badge>{c.depth}</Badge>
          <Badge>{c.usage.calls} calls · {(c.usage.latencyMs / 1000).toFixed(1)}s</Badge>
        </div>
      </div>
      <Card className="mb-4" title="Your brief">
        <p className="whitespace-pre-wrap text-sm">{c.brief}</p>
      </Card>

      {c.status === "analysing" ? (
        <Card className="mb-4">
          <p className="text-sm text-text-muted">The council has not convened yet.</p>
          <Button className="mt-2" onClick={() => actions.rerun.mutate()} loading={actions.rerun.isPending}>
            Convene now
          </Button>
          <ErrorNote error={actions.rerun.error} />
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.analyses.map((a) => (
          <Card key={a.role} title={ROLE_META[a.role].label}>
            <div className="text-xs text-text-faint">{ROLE_META[a.role].angle}</div>
            <p className="mt-2 text-sm">{a.summary}</p>
            <ul className="mt-2 space-y-1">
              {a.points.map((p, i) => (
                <li key={i} className="text-sm">
                  <Badge tone={p.kind === "risk" || p.kind === "unsupported_claim" ? "warning" : p.kind === "question" ? "info" : p.kind === "recommendation" ? "accent" : "neutral"}>{p.kind.replace(/_/g, " ")}</Badge>{" "}
                  {p.text}
                  {p.confidence !== null ? <span className="text-xs text-text-faint"> ({Math.round(p.confidence * 100)}%)</span> : null}
                </li>
              ))}
            </ul>
            {a.informationRequests.length ? (
              <div className="mt-2 text-xs text-text-muted">Wants to know: {a.informationRequests.join("; ")}</div>
            ) : null}
            {a.uncertainty ? <div className="mt-1 text-xs text-text-faint">Uncertain about: {a.uncertainty}</div> : null}
            {c.critiques.find((x) => x.role === a.role)?.text ? (
              <div className="mt-3 border-t border-border pt-2 text-xs">
                <div className="font-medium uppercase tracking-[0.18em] text-text-faint">On the others</div>
                <p className="mt-1 text-text-muted">{c.critiques.find((x) => x.role === a.role)!.text}</p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {c.status === "open" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Ask a role">
            {c.exchanges.length ? (
              <ul className="mb-3 space-y-2 text-sm">
                {c.exchanges.map((x) => (
                  <li key={x.id} className={cx("rounded-lg p-2", x.role === null ? "bg-accent-soft" : "bg-surface-muted")}>
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">{x.role === null ? "You" : ROLE_META[x.role].label}</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{x.content}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <form onSubmit={ask} className="space-y-2">
              <select required value={askRole} onChange={(e) => setAskRole(e.target.value as CouncilRole)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                <option value="">Choose a role</option>
                {c.roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_META[r].label}
                  </option>
                ))}
              </select>
              <Textarea rows={2} required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Follow-up question" />
              <ErrorNote error={actions.ask.error} />
              <Button type="submit" size="sm" loading={actions.ask.isPending}>
                Ask
              </Button>
            </form>
          </Card>
          <DecisionForm council={c} onDecide={(body) => actions.decide.mutateAsync(body)} busy={actions.decide.isPending} error={actions.decide.error} />
        </div>
      ) : null}

      {c.decision ? (
        <Card className="mt-4" title="Your decision">
          <p className="text-sm font-medium">{c.decision.decision}</p>
          <p className="mt-1 text-sm text-text-muted">{c.decision.rationale}</p>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            <div><span className="font-medium">Accepted:</span> {c.decision.accepted.join("; ") || "—"}</div>
            <div><span className="font-medium">Rejected:</span> {c.decision.rejected.join("; ") || "—"}</div>
            <div><span className="font-medium">To investigate:</span> {c.decision.toInvestigate.join("; ") || "—"}</div>
          </div>
          <div className="mt-2"><Badge>Confidence {Math.round(c.decision.confidence * 100)}%</Badge></div>
        </Card>
      ) : null}
    </div>
  );
}

function DecisionForm({ council, onDecide, busy, error }: { council: CouncilSession; onDecide: (b: { decision: string; rationale: string; accepted: string[]; rejected: string[]; toInvestigate: string[]; confidence: number }) => Promise<unknown>; busy: boolean; error: unknown }) {
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [accepted, setAccepted] = useState("");
  const [rejected, setRejected] = useState("");
  const [investigate, setInvestigate] = useState("");
  const [confidence, setConfidence] = useState(60);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onDecide({ decision, rationale, accepted: lines(accepted), rejected: lines(rejected), toInvestigate: lines(investigate), confidence: confidence / 100 });
  };
  return (
    <Card title="Record your decision">
      <p className="mb-2 text-xs text-text-faint">The council advised; this is yours. {council.roles.length} roles weighed in.</p>
      <form onSubmit={submit} className="space-y-2">
        <Input required placeholder="Decision" value={decision} onChange={(e) => setDecision(e.target.value)} maxLength={2000} />
        <Textarea rows={3} required placeholder="Rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} />
        <Textarea rows={2} placeholder="Accepted (one per line)" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
        <Textarea rows={2} placeholder="Rejected (one per line)" value={rejected} onChange={(e) => setRejected(e.target.value)} />
        <Textarea rows={2} placeholder="To investigate (one per line)" value={investigate} onChange={(e) => setInvestigate(e.target.value)} />
        <div>
          <Label>Confidence: {confidence}%</Label>
          <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>
        <ErrorNote error={error} />
        <Button type="submit" loading={busy}>
          Record decision
        </Button>
      </form>
    </Card>
  );
}
