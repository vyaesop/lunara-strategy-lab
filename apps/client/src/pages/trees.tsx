import { useState, type FormEvent } from "react";
import { GitBranch, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner } from "@/components/ui";
import { useTreeActions, useTrees } from "@/lib/queries-lab";

export function TreesPage() {
  const trees = useTrees();
  const actions = useTreeActions();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.create.mutateAsync({ title, objective });
    navigate(`/app/trees/${r.tree.id}`);
  };

  return (
    <div>
      <PageTitle eyebrow="Scenario trees" title="Branching plans" subtitle="Map decisions, the responses they provoke, and the contingencies you will need. Then let the auditor find the branch you forgot." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="New tree">
          <form onSubmit={create} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Regional launch plan" />
            </div>
            <div>
              <Label hint="What are you trying to achieve?">Objective</Label>
              <Input value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={500} />
            </div>
            <ErrorNote error={actions.create.error} />
            <Button type="submit" loading={actions.create.isPending}>
              Create
            </Button>
          </form>
        </Card>
        <Card className="lg:col-span-2" title="Your trees">
          {trees.isPending ? (
            <Spinner />
          ) : trees.data && trees.data.trees.length > 0 ? (
            <ul className="divide-y divide-border">
              {trees.data.trees.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <Link to={`/app/trees/${t.id}`} className="min-w-0 flex-1 hover:text-accent">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <GitBranch className="h-4 w-4 text-accent" /> {t.title}
                    </div>
                    <div className="text-xs text-text-faint">
                      {t.nodeCount} nodes · v{t.version} · updated {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </Link>
                  <button aria-label="Delete tree" className="text-text-faint hover:text-danger" onClick={() => confirm(`Delete "${t.title}"?`) && actions.remove.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No trees yet" body="Create one from an exercise you are working on or from a real decision." />
          )}
        </Card>
      </div>
    </div>
  );
}
