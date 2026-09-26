import { useState, type FormEvent } from "react";
import { ArrowRight, Flag, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { MissionStepKind } from "@lunara/schemas";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useMissionActions, useMissionSession, useMissionSessions, useMissions } from "@/lib/queries-missions";
import { useProjects } from "@/lib/queries-strategy";

const STEP_LINKS: Partial<Record<MissionStepKind, { label: string; to: string }>> = {
  tree: { label: "Open Scenario Trees", to: "/app/trees" },
  council: { label: "Open War Room", to: "/app/war-room" },
  decision: { label: "Open Decision Journal", to: "/app/journal" },
  prediction: { label: "Open Decision Journal", to: "/app/journal" },
};

export function MissionsPage() {
  const missions = useMissions();
  const sessions = useMissionSessions();
  const projects = useProjects();
  const actions = useMissionActions();
  const navigate = useNavigate();
  const [showBuilder, setShowBuilder] = useState(false);
  const byMission = new Map((sessions.data?.sessions ?? []).map((s) => [s.missionId, s]));
  return (
    <div>
      <PageTitle eyebrow="Missions" title="Connected exercises" subtitle="Curated sequences on strategy problems, or your own mission built from a project." action={<Button variant="secondary" onClick={() => setShowBuilder((s) => !s)}>{showBuilder ? "Close" : "Build a custom mission"}</Button>} />
      {showBuilder ? <MissionBuilder projects={projects.data?.projects ?? []} onDone={() => setShowBuilder(false)} /> : null}
      {missions.isPending ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {missions.data?.missions.map((m) => {
            const prior = byMission.get(m.id);
            return (
              <div key={m.id} className="panel p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={m.source === "custom" ? "accent" : "info"}>{m.source}</Badge>
                  <span className="text-xs text-text-faint">{m.steps.length} steps · about {m.estimatedMinutes} min</span>
                </div>
                <h3 className="mt-3 text-xl">{m.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{m.summary}</p>
                <ul className="mt-2 text-xs text-text-faint">{m.objectives.map((o) => <li key={o}>· {o}</li>)}</ul>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {prior?.status === "active" ? <Link to={`/app/missions/${prior.id}`}><Button size="sm">Continue <ArrowRight className="h-4 w-4" /></Button></Link> : null}
                  <Button size="sm" variant={prior?.status === "active" ? "secondary" : "primary"} onClick={async () => navigate(`/app/missions/${(await actions.start.mutateAsync(m.id)).session.id}`)} loading={actions.start.isPending}>{prior ? "Start again" : "Start"}</Button>
                  {prior?.status === "completed" ? <Link to={`/app/missions/${prior.id}`} className="text-sm text-text-muted hover:text-text">Debrief</Link> : null}
                  {m.source === "custom" ? <button aria-label="Delete mission" className="ml-auto text-text-faint hover:text-danger" onClick={() => confirm(`Delete "${m.title}"?`) && actions.deleteCustom.mutate(m.id)}><Trash2 className="h-4 w-4" /></button> : null}
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

function MissionBuilder({ projects, onDone }: { projects: Array<{ id: string; title: string }>; onDone: () => void }) {
  const actions = useMissionActions();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [objectives, setObjectives] = useState("");
  const [projectId, setProjectId] = useState("");
  const [steps, setSteps] = useState<Array<{ title: string; kind: MissionStepKind; prompt: string }>>([
    { title: "What must be true", kind: "reflection", prompt: "" },
    { title: "Decide", kind: "decision", prompt: "" },
  ]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await actions.createCustom.mutateAsync({ title, summary, objectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6), constraints: [], projectId: projectId || null, steps: steps.map((s) => ({ ...s, guidance: "" })) });
    onDone();
  };
  return (
    <Card className="mb-4" title="Custom mission">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={280} /></div>
          <div>
            <Label>From project (optional)</Label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          </div>
        </div>
        <div><Label>Summary</Label><Textarea rows={2} required value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        <div><Label hint="One per line">Objectives</Label><Textarea rows={2} required value={objectives} onChange={(e) => setObjectives(e.target.value)} /></div>
        <div>
          <Label hint="2 to 12, in order">Steps</Label>
          {steps.map((s, i) => (
            <div key={i} className="mb-2 grid gap-1 sm:grid-cols-[1fr_140px_2fr_auto]">
              <Input placeholder="Step title" required value={s.title} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <select value={s.kind} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, kind: e.target.value as MissionStepKind } : x)))} className="h-10 rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                {(["reflection", "plan", "decision", "prediction", "tree", "council"] as MissionStepKind[]).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <Input placeholder="Prompt" required value={s.prompt} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              <Button type="button" size="sm" variant="ghost" disabled={steps.length <= 2} onClick={() => setSteps((ss) => ss.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" disabled={steps.length >= 12} onClick={() => setSteps((ss) => [...ss, { title: "", kind: "reflection", prompt: "" }])}>+ step</Button>
        </div>
        <ErrorNote error={actions.createCustom.error} />
        <Button type="submit" loading={actions.createCustom.isPending}>Create mission</Button>
      </form>
    </Card>
  );
}

export function MissionPage() {
  const { sessionId = "" } = useParams();
  const q = useMissionSession(sessionId);
  const actions = useMissionActions(sessionId);
  const [draft, setDraft] = useState("");
  const [refId, setRefId] = useState("");
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { session } = q.data;
  const def = session.definition;
  const answered = new Map(session.responses.map((r) => [r.stepId, r]));
  const currentIdx = def.steps.findIndex((s) => !answered.has(s.id));
  const allDone = currentIdx === -1;
  const active = session.status === "active";

  const submit = async (stepId: string) => {
    await actions.respond.mutateAsync({ stepId, response: draft, refId: refId.trim() || null });
    setDraft("");
    setRefId("");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link to="/app/missions" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">Missions</Link>
        <h1 className="text-3xl">{def.title}</h1>
        <div className="mt-1 flex flex-wrap gap-2"><Badge tone={active ? "accent" : "neutral"}>{session.status}</Badge><Badge>{session.responses.length}/{def.steps.length} steps</Badge></div>
      </div>
      <ol className="space-y-3">
        {def.steps.map((s, i) => {
          const r = answered.get(s.id);
          const isCurrent = active && i === currentIdx;
          const link = STEP_LINKS[s.kind];
          return (
            <li key={s.id} className={cx("panel p-4", isCurrent ? "border-accent" : r ? "" : "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium"><Flag className={cx("h-4 w-4", r ? "text-success" : isCurrent ? "text-accent" : "text-text-faint")} /> {i + 1}. {s.title}</div>
                <Badge>{s.kind}</Badge>
              </div>
              <p className="mt-2 text-sm">{s.prompt}</p>
              {s.guidance ? <p className="mt-1 text-xs text-text-faint">{s.guidance}</p> : null}
              {s.kind === "exercise" && s.exerciseId ? <Link to={`/app/train/${s.exerciseId}`} className="mt-1 inline-block text-xs text-accent">Open the exercise →</Link> : null}
              {link ? <Link to={link.to} className="mt-1 ml-3 inline-block text-xs text-accent">{link.label} →</Link> : null}
              {r ? (
                <div className="mt-2 rounded-lg bg-surface-muted p-2 text-sm">
                  <p className="whitespace-pre-wrap">{r.response || <span className="text-text-faint">(artefact linked)</span>}</p>
                  {r.refId ? <div className="text-xs text-text-faint">Linked: {r.refId}</div> : null}
                </div>
              ) : null}
              {isCurrent ? (
                <div className="mt-3 space-y-2">
                  <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your response" />
                  {["tree", "council", "decision", "prediction", "exercise"].includes(s.kind) ? <Input value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="Optional: paste the id of the tree, council, decision or session you created" /> : null}
                  <ErrorNote error={actions.respond.error} />
                  <Button size="sm" onClick={() => submit(s.id)} loading={actions.respond.isPending} disabled={!draft.trim() && !refId.trim()}>Save step</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {active && allDone ? (
        <Card className="mt-4" title="Debrief">
          <p className="text-sm text-text-muted">Every step is answered. The debrief scores coherence across steps against the mission rubric and records skill evidence.</p>
          <Button className="mt-2" onClick={() => actions.debrief.mutate()} loading={actions.debrief.isPending}>Generate debrief</Button>
          <ErrorNote error={actions.debrief.error} />
        </Card>
      ) : null}
      {session.debrief ? (
        <Card className="mt-4" title="Debrief">
          <Badge tone="accent">Overall {Math.round(session.debrief.overallScore * 100)}</Badge>
          <ul className="mt-2 space-y-1">{session.debrief.criteria.map((c) => <li key={c.criterionId} className="rounded-lg border border-border p-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{c.criterionId.replace(/_/g, " ")}</span><ScoreBar value={c.score} /></div><p className="text-xs text-text-muted">{c.evidence}</p></li>)}</ul>
          <p className="mt-3 whitespace-pre-wrap text-sm">{session.debrief.debrief}</p>
        </Card>
      ) : null}
      {active && !allDone ? <Button variant="ghost" className="mt-4" onClick={() => confirm("Abandon this mission?") && actions.abandon.mutate()}>Abandon</Button> : null}
      {!active && !session.debrief ? <EmptyState title="Mission ended without a debrief" /> : null}
    </div>
  );
}
