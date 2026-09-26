import { useState, type FormEvent } from "react";
import { Check, Sparkles, Trash2, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { ProjectSection, ProjectSuggestions } from "@lunara/schemas";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useProject, useProjectActions, useProjects } from "@/lib/queries-strategy";

const SECTIONS: Array<{ key: ProjectSection; label: string; hint: string }> = [
  { key: "objectives", label: "Objectives", hint: "What success looks like, measurably" },
  { key: "milestones", label: "Milestones", hint: "Dated checkpoints" },
  { key: "constraints", label: "Constraints", hint: "Money, time, rules, people" },
  { key: "stakeholders", label: "Stakeholders", hint: "Who decides, who is affected" },
  { key: "resources", label: "Resources", hint: "What you have to work with" },
  { key: "risks", label: "Risks", hint: "What could go wrong, how likely, how bad" },
  { key: "assumptions", label: "Assumptions", hint: "What the plan depends on" },
  { key: "options", label: "Strategic options", hint: "Different ways to get there" },
  { key: "outcomes", label: "Outcomes", hint: "What actually happened" },
  { key: "lessons", label: "Lessons", hint: "What you would do differently" },
];

export function ProjectsPage() {
  const projects = useProjects();
  const actions = useProjectActions();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.create.mutateAsync({ title, summary });
    navigate(`/app/projects/${r.project.id}`);
  };
  return (
    <div>
      <PageTitle eyebrow="Strategy Lab" title="Your projects" subtitle="Real goals and decisions, structured the way the exercises taught you. AI can suggest structure; it never owns the project." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="New project">
          <form onSubmit={create} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={280} />
            </div>
            <div>
              <Label>Summary</Label>
              <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} />
            </div>
            <ErrorNote error={actions.create.error} />
            <Button type="submit" loading={actions.create.isPending}>Create</Button>
          </form>
        </Card>
        <Card className="lg:col-span-2" title="Projects">
          {projects.isPending ? <Spinner /> : projects.data && projects.data.projects.length ? (
            <ul className="divide-y divide-border">
              {projects.data.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link to={`/app/projects/${p.id}`} className="min-w-0 flex-1 hover:text-accent">
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-text-faint">{p.status} · {Object.values(p.sections).reduce((a, s) => a + s.length, 0)} items · updated {new Date(p.updatedAt).toLocaleDateString()}</div>
                  </Link>
                  <button aria-label="Delete project" className="text-text-faint hover:text-danger" onClick={() => confirm(`Delete "${p.title}"?`) && actions.remove.mutate(p.id)}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No projects yet" body="Bring a real decision, launch, negotiation or plan." />}
        </Card>
      </div>
    </div>
  );
}

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const q = useProject(projectId);
  const actions = useProjectActions(projectId);
  const [drafts, setDrafts] = useState<Partial<Record<ProjectSection, string>>>({});
  const [suggestions, setSuggestions] = useState<ProjectSuggestions | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const p = q.data.project;

  const add = async (section: ProjectSection) => {
    const text = (drafts[section] ?? "").trim();
    if (!text) return;
    await actions.upsertItem.mutateAsync({ section, text });
    setDrafts((d) => ({ ...d, [section]: "" }));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/app/projects" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">Strategy Lab</Link>
          <h1 className="text-3xl">{p.title}</h1>
          {p.summary ? <p className="mt-1 max-w-2xl text-sm text-text-muted">{p.summary}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <select value={p.status} onChange={(e) => actions.update.mutate({ status: e.target.value })} className="h-9 rounded-lg border border-border bg-bg-elevated px-2 text-sm">
            {["active", "paused", "completed", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={async () => setSuggestions((await actions.suggest.mutateAsync()).suggestions)} loading={actions.suggest.isPending}>
            <Sparkles className="h-4 w-4" /> Suggest structure
          </Button>
        </div>
      </div>
      <ErrorNote error={actions.suggest.error ?? actions.upsertItem.error} />

      {suggestions ? (
        <Card className="mb-4" title="Suggestions (accept or discard each)">
          <ul className="space-y-2">
            {suggestions.suggestions.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                <div>
                  <Badge>{s.section}</Badge> {s.text}
                  <div className="text-xs text-text-faint">{s.why}</div>
                </div>
                <div className="flex gap-1">
                  <button aria-label="Accept" className="rounded p-1 text-success hover:bg-success-soft" onClick={async () => { await actions.upsertItem.mutateAsync({ section: s.section, text: s.text }); setSuggestions((cur) => cur && { ...cur, suggestions: cur.suggestions.filter((_, j) => j !== i) }); }}><Check className="h-4 w-4" /></button>
                  <button aria-label="Discard" className="rounded p-1 text-text-faint hover:bg-surface-muted" onClick={() => setSuggestions((cur) => cur && { ...cur, suggestions: cur.suggestions.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          {suggestions.questions.length ? (
            <div className="mt-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Questions to answer</div>
              <ul className="list-disc pl-5 text-text-muted">{suggestions.questions.map((qn) => <li key={qn}>{qn}</li>)}</ul>
            </div>
          ) : null}
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSuggestions(null)}>Close</Button>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.key} title={s.label}>
            <p className="mb-2 text-xs text-text-faint">{s.hint}</p>
            <ul className="space-y-1">
              {(p.sections[s.key] ?? []).map((it) => (
                <li key={it.id} className={cx("flex items-start justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-muted", it.status !== "open" && "opacity-60 line-through")}>
                  <button className="min-w-0 flex-1 text-left" onClick={() => actions.upsertItem.mutate({ section: s.key, id: it.id, text: it.text, status: it.status === "open" ? "done" : "open" })} title="Toggle done">{it.text}</button>
                  <button aria-label="Remove" className="text-text-faint hover:text-danger" onClick={() => actions.deleteItem.mutate({ section: s.key, id: it.id })}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); void add(s.key); }} className="mt-2 flex gap-1">
              <Input value={drafts[s.key] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))} placeholder={`Add to ${s.label.toLowerCase()}`} maxLength={2000} />
              <Button type="submit" size="sm" variant="secondary">Add</Button>
            </form>
          </Card>
        ))}
        <Card className="md:col-span-2" title="Notes">
          <Textarea rows={6} value={notes ?? p.notes} onChange={(e) => setNotes(e.target.value)} maxLength={20_000} />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" disabled={notes === null || notes === p.notes} onClick={() => actions.update.mutate({ notes }, { onSuccess: () => setNotes(null) })} loading={actions.update.isPending}>Save notes</Button>
            <Link to={`/app/journal?projectId=${p.id}`} className="text-sm text-accent">Log a decision for this project →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
