import { useMemo, useState, type FormEvent } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2 } from "lucide-react";
import type { KnowledgeConcept, KnowledgeRelation, RelationKind } from "@lunara/schemas";
import { conceptDegrees } from "@lunara/core";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { useKnowledgeActions, useKnowledgeGraph } from "@/lib/queries-reading";

const KINDS: KnowledgeConcept["kind"][] = ["concept", "technique", "principle", "person", "strategy", "framework", "mistake_pattern"];
const RELATIONS: RelationKind[] = ["supports", "contradicts", "explains", "applies_to", "derived_from", "similar_to", "depends_on"];
const EMPTY_CONCEPTS: KnowledgeConcept[] = [];
const EMPTY_RELATIONS: KnowledgeRelation[] = [];

export function KnowledgePage() {
  const graph = useKnowledgeGraph();
  const actions = useKnowledgeActions();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<KnowledgeConcept["kind"]>("concept");
  const [summary, setSummary] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [relKind, setRelKind] = useState<RelationKind>("supports");
  const [selected, setSelected] = useState<string | null>(null);
  const [mergeInto, setMergeInto] = useState("");

  const concepts = graph.data?.concepts ?? EMPTY_CONCEPTS;
  const relations = graph.data?.relations ?? EMPTY_RELATIONS;
  const degrees = useMemo(() => conceptDegrees(concepts, relations), [concepts, relations]);

  const flow = useMemo(() => {
    const n = concepts.length || 1;
    const radius = Math.max(160, 40 * n);
    const nodes: Node[] = concepts.map((c, i) => ({
      id: c.id,
      position: { x: radius + radius * Math.cos((2 * Math.PI * i) / n), y: radius + radius * Math.sin((2 * Math.PI * i) / n) },
      data: { label: c.name },
      style: {
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 10,
        border: `1px solid ${c.provenance.confirmed ? "var(--border-strong)" : "var(--warning)"}`,
        background: selected === c.id ? "var(--accent-soft)" : "var(--surface)",
        color: "var(--text)",
        width: "auto",
      },
    }));
    const edges: Edge[] = relations.map((r) => ({ id: r.id, source: r.fromId, target: r.toId, label: r.kind.replace(/_/g, " "), labelStyle: { fontSize: 10, fill: "var(--text-faint)" }, style: { stroke: r.kind === "contradicts" ? "var(--danger)" : "var(--border-strong)" } }));
    return { nodes, edges };
  }, [concepts, relations, selected]);

  const addConcept = async (e: FormEvent) => {
    e.preventDefault();
    await actions.createConcept.mutateAsync({ name, kind, summary });
    setName("");
    setSummary("");
  };
  const addRelation = async (e: FormEvent) => {
    e.preventDefault();
    await actions.createRelation.mutateAsync({ fromId, toId, kind: relKind });
  };

  const sel = concepts.find((c) => c.id === selected) ?? null;

  return (
    <div>
      <PageTitle eyebrow="Knowledge" title="Concept graph" subtitle="Concepts and how they relate, across books, sessions and your own notes. Suggestions from AI stay marked until you confirm them." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card title="Add concept">
            <form onSubmit={addConcept} className="space-y-2">
              <Input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={280} />
              <select value={kind} onChange={(e) => setKind(e.target.value as KnowledgeConcept["kind"])} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <Textarea rows={2} placeholder="Summary in your own words" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
              <ErrorNote error={actions.createConcept.error} />
              <Button type="submit" size="sm" loading={actions.createConcept.isPending}>Add</Button>
              <p className="text-xs text-text-faint">Names are canonicalised; adding an existing name returns the existing concept instead of a duplicate.</p>
            </form>
          </Card>
          <Card title="Add relation">
            <form onSubmit={addRelation} className="space-y-2">
              <select required value={fromId} onChange={(e) => setFromId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                <option value="">From…</option>
                {concepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={relKind} onChange={(e) => setRelKind(e.target.value as RelationKind)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                {RELATIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
              <select required value={toId} onChange={(e) => setToId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                <option value="">To…</option>
                {concepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ErrorNote error={actions.createRelation.error} />
              <Button type="submit" size="sm" variant="secondary" loading={actions.createRelation.isPending}>Link</Button>
            </form>
          </Card>
          {sel ? (
            <Card title={sel.name}>
              <div className="flex flex-wrap gap-1">
                <Badge>{sel.kind.replace(/_/g, " ")}</Badge>
                <Badge tone={sel.provenance.confirmed ? "success" : "warning"}>{sel.provenance.confirmed ? "confirmed" : "AI suggestion"}</Badge>
                <Badge>{degrees.get(sel.id) ?? 0} links</Badge>
              </div>
              {sel.summary ? <p className="mt-2 text-sm">{sel.summary}</p> : null}
              {sel.aliases.length ? <p className="mt-1 text-xs text-text-faint">Also: {sel.aliases.join(", ")}</p> : null}
              <div className="mt-3 space-y-2">
                {!sel.provenance.confirmed ? (
                  <Button size="sm" onClick={() => actions.updateConcept.mutate({ id: sel.id, patch: { confirmed: true } })}>Confirm</Button>
                ) : null}
                <div>
                  <Label hint="Moves relations, notes and review items to the target">Merge into</Label>
                  <div className="flex gap-1">
                    <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-2 text-sm">
                      <option value="">Choose…</option>
                      {concepts.filter((c) => c.id !== sel.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button size="sm" variant="secondary" disabled={!mergeInto} onClick={() => confirm(`Merge "${sel.name}"?`) && actions.mergeConcept.mutate({ id: sel.id, intoId: mergeInto }, { onSuccess: () => setSelected(mergeInto) })}>Merge</Button>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => confirm(`Delete "${sel.name}"?`) && actions.deleteConcept.mutate(sel.id, { onSuccess: () => setSelected(null) })}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
              <div className="mt-3 text-xs text-text-faint">Relations</div>
              <ul className="text-xs">
                {relations.filter((r) => r.fromId === sel.id || r.toId === sel.id).map((r) => {
                  const other = concepts.find((c) => c.id === (r.fromId === sel.id ? r.toId : r.fromId));
                  return (
                    <li key={r.id} className="flex items-center justify-between py-0.5">
                      <span>{r.fromId === sel.id ? `${r.kind.replace(/_/g, " ")} → ${other?.name}` : `${other?.name} ${r.kind.replace(/_/g, " ")} → this`}</span>
                      <button aria-label="Delete relation" className="text-text-faint hover:text-danger" onClick={() => actions.deleteRelation.mutate(r.id)}><Trash2 className="h-3 w-3" /></button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
        <div className="lg:col-span-2">
          {graph.isPending ? (
            <Spinner />
          ) : concepts.length === 0 ? (
            <EmptyState title="No concepts yet" body="Add one here, or generate questions from a document and save the suggested concepts." />
          ) : (
            <div className="h-[560px] overflow-hidden rounded-xl border border-border bg-bg-elevated">
              <ReactFlow nodes={flow.nodes} edges={flow.edges} onNodeClick={(_, n) => setSelected(n.id)} fitView proOptions={{ hideAttribution: true }} nodesDraggable nodesConnectable={false}>
                <Background gap={24} color="var(--border)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          )}
          {concepts.length ? (
            <ul className="mt-3 flex flex-wrap gap-1">
              {concepts.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c.id)} className={cx("rounded-full border px-2 py-0.5 text-xs", selected === c.id ? "border-accent bg-accent-soft text-accent" : c.provenance.confirmed ? "border-border text-text-muted" : "border-warning/50 text-warning")}>
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
