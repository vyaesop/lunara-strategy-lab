import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, Redo2, Save, Undo2 } from "lucide-react";
import type { CritiqueFinding, CritiqueMode, ScenarioTree, TreeGraph, TreeNode, TreeNodeType } from "@lunara/schemas";
import { diffGraphs } from "@lunara/core";
import { Badge, Button, Card, ErrorNote, Input, Label, Spinner, Textarea, cx } from "@/components/ui";
import { useTree, useTreeActions } from "@/lib/queries-lab";

const TYPE_META: Record<TreeNodeType, { label: string; color: string }> = {
  objective: { label: "Objective", color: "var(--accent)" },
  decision: { label: "Decision", color: "var(--info)" },
  opponent_response: { label: "Opponent response", color: "var(--danger)" },
  event: { label: "Event / uncertainty", color: "var(--warning)" },
  information_action: { label: "Information action", color: "var(--info)" },
  hypothesis: { label: "Hypothesis", color: "var(--text-muted)" },
  outcome: { label: "Outcome", color: "var(--success)" },
  contingency: { label: "Contingency", color: "var(--success)" },
  assumption: { label: "Assumption", color: "var(--text-faint)" },
};

type FlowNode = Node<TreeNode, "lunara">;

function LunaraNode({ data, selected }: NodeProps<FlowNode>) {
  const meta = TYPE_META[data.type];
  return (
    <div
      className={cx("min-w-[160px] max-w-[220px] rounded-lg border bg-surface px-3 py-2 text-xs shadow-panel", selected ? "border-accent" : "border-border")}
      style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-border-strong" />
      <div className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: meta.color }}>
        {meta.label}
      </div>
      <div className="mt-0.5 font-medium text-text">{data.title}</div>
      {data.probability !== null ? <div className="text-text-faint">p = {Math.round(data.probability * 100)}%</div> : null}
      {data.risk ? <div className="text-text-faint">risk {data.risk}</div> : null}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-border-strong" />
    </div>
  );
}

const nodeTypes = { lunara: LunaraNode };

const toFlow = (g: TreeGraph): { nodes: FlowNode[]; edges: Edge[] } => ({
  nodes: g.nodes.map((n) => ({ id: n.id, type: "lunara", position: n.position, data: n })),
  edges: g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label || undefined })),
});
const fromFlow = (nodes: FlowNode[], edges: Edge[]): TreeGraph => ({
  nodes: nodes.map((n) => ({ ...n.data, id: n.id, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" ? e.label : "" })),
});

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

function blankNode(type: TreeNodeType, position: { x: number; y: number }): TreeNode {
  return { id: uid("node"), type, title: TYPE_META[type].label, description: "", preconditions: "", probability: null, cost: "", time: "", risk: null, evidenceRefs: [], notes: "", position, collapsed: false };
}

export function TreeEditorPage() {
  const { treeId = "" } = useParams();
  const q = useTree(treeId);
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  return <Editor key={`${q.data.tree.id}:${q.data.tree.version}`} tree={q.data.tree} />;
}

function Editor({ tree }: { tree: ScenarioTree }) {
  const actions = useTreeActions(tree.id);
  const initial = useMemo(() => toFlow(tree.graph), [tree.graph]);
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState(tree.title);
  const [objective, setObjective] = useState(tree.objective);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<"node" | "critique" | "versions">("node");
  const history = useRef<{ past: TreeGraph[]; future: TreeGraph[] }>({ past: [], future: [] });

  const snapshot = useCallback(() => {
    history.current.past = [...history.current.past.slice(-49), fromFlow(nodes, edges)];
    history.current.future = [];
  }, [nodes, edges]);

  const load = (g: TreeGraph) => {
    const f = toFlow(g);
    setNodes(f.nodes);
    setEdges(f.edges);
    setDirty(true);
  };
  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(fromFlow(nodes, edges));
    load(prev);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(fromFlow(nodes, edges));
    load(next);
  };

  // Keyboard shortcuts read the latest handlers through a ref so the listener is registered once.
  const shortcuts = useRef<{ undo: () => void; redo: () => void; save: () => void }>({ undo: () => {}, redo: () => {}, save: () => {} });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        shortcuts.current.undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        shortcuts.current.redo();
      } else if (e.key === "s") {
        e.preventDefault();
        shortcuts.current.save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    if (changes.some((c) => c.type === "remove" || (c.type === "position" && c.dragging === false))) setDirty(true);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
    if (changes.some((c) => c.type === "remove")) setDirty(true);
  }, []);
  const onConnect = useCallback(
    (c: Connection) => {
      snapshot();
      setEdges((es) => addEdge({ ...c, id: uid("edge") }, es));
      setDirty(true);
    },
    [snapshot],
  );

  const addNode = (type: TreeNodeType) => {
    snapshot();
    const parent = nodes.find((n) => n.id === selectedId);
    const siblings = parent ? edges.filter((e) => e.source === parent.id).length : 0;
    const position = parent ? { x: parent.position.x + siblings * 240, y: parent.position.y + 140 } : { x: 40 + nodes.length * 30, y: 40 + nodes.length * 30 };
    const node = blankNode(type, position);
    setNodes((ns) => [...ns, { id: node.id, type: "lunara", position, data: node }]);
    if (parent) setEdges((es) => [...es, { id: uid("edge"), source: parent.id, target: node.id }]);
    setSelectedId(node.id);
    setDirty(true);
  };

  const updateSelected = (patch: Partial<TreeNode>) => {
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
    setDirty(true);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    snapshot();
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };

  const save = async () => {
    await actions.save.mutateAsync({ title, objective, graph: fromFlow(nodes, edges), baseVersion: tree.version });
    setDirty(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ title, objective, graph: fromFlow(nodes, edges) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "tree"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    shortcuts.current = { undo, redo, save: () => void save() };
  });

  const selected = nodes.find((n) => n.id === selectedId)?.data ?? null;
  const latestCritique = tree.critiques.at(-1) ?? null;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link to="/app/trees" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
          Trees
        </Link>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="min-w-[200px] flex-1 bg-transparent font-serif text-xl outline-none" aria-label="Tree title" />
        <Badge>v{tree.version}</Badge>
        {dirty ? <Badge tone="warning">unsaved</Badge> : <Badge tone="success">saved</Badge>}
        <Button size="sm" variant="ghost" onClick={undo} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={redo} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={exportJson} aria-label="Export JSON"><Download className="h-4 w-4" /></Button>
        <Button size="sm" onClick={save} loading={actions.save.isPending} disabled={!dirty}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
      <ErrorNote error={actions.save.error} />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div data-lenis-prevent className="relative min-h-[360px] overflow-hidden rounded-xl border border-border bg-bg-elevated">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => { setSelectedId(n.id); setPanel("node"); }}
            onNodeDragStart={snapshot}
            onPaneClick={() => setSelectedId(null)}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} color="var(--border)" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden md:!block" nodeColor={(n) => TYPE_META[(n.data as TreeNode).type].color} />
          </ReactFlow>
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 rounded-lg border border-border bg-surface/95 p-1.5 backdrop-blur">
            {(Object.keys(TYPE_META) as TreeNodeType[]).map((t) => (
              <button key={t} onClick={() => addNode(t)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-surface-muted" style={{ borderLeftWidth: 3, borderLeftColor: TYPE_META[t].color }} title={selectedId ? "Add as child of the selected node" : "Add node"}>
                + {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>

        <aside data-lenis-prevent className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <div className="flex gap-1">
            {(["node", "critique", "versions"] as const).map((p) => (
              <button key={p} onClick={() => setPanel(p)} className={cx("rounded-lg px-3 py-1.5 text-sm capitalize", panel === p ? "bg-accent-soft text-accent font-medium" : "text-text-muted")}>
                {p}
              </button>
            ))}
          </div>
          {panel === "node" ? (
            selected ? (
              <NodePanel node={selected} onChange={updateSelected} onDelete={deleteSelected} />
            ) : (
              <Card>
                <Label hint="What are you trying to achieve?">Objective</Label>
                <Textarea rows={3} value={objective} onChange={(e) => { setObjective(e.target.value); setDirty(true); }} />
                <p className="mt-3 text-xs text-text-faint">Select a node to edit it. With a node selected, the palette adds children to it. Drag from a node's bottom handle to connect. Delete removes the selected node.</p>
              </Card>
            )
          ) : panel === "critique" ? (
            <CritiquePanel tree={tree} latest={latestCritique} dirty={dirty} actions={actions} onSelectNode={(id) => { setSelectedId(id); setPanel("node"); }} />
          ) : (
            <VersionsPanel tree={tree} current={fromFlow(nodes, edges)} onRestore={(g) => { snapshot(); load(g); }} />
          )}
        </aside>
      </div>
    </div>
  );
}

function NodePanel({ node, onChange, onDelete }: { node: TreeNode; onChange: (p: Partial<TreeNode>) => void; onDelete: () => void }) {
  const probabilityRelevant = ["event", "opponent_response", "outcome"].includes(node.type);
  return (
    <Card>
      <div className="space-y-3">
        <div>
          <Label>Type</Label>
          <select value={node.type} onChange={(e) => onChange({ type: e.target.value as TreeNodeType })} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
            {(Object.keys(TYPE_META) as TreeNodeType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Title</Label>
          <Input value={node.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={280} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={3} value={node.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={2000} />
        </div>
        {probabilityRelevant ? (
          <div>
            <Label hint="Leave blank if a number would be made up">Probability: {node.probability === null ? "not set" : `${Math.round(node.probability * 100)}%`}</Label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={node.probability === null ? 50 : Math.round(node.probability * 100)} onChange={(e) => onChange({ probability: Number(e.target.value) / 100 })} className="flex-1 accent-[var(--accent)]" />
              <Button size="sm" variant="ghost" onClick={() => onChange({ probability: null })}>clear</Button>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Cost</Label>
            <Input value={node.cost} onChange={(e) => onChange({ cost: e.target.value })} maxLength={120} />
          </div>
          <div>
            <Label>Time</Label>
            <Input value={node.time} onChange={(e) => onChange({ time: e.target.value })} maxLength={120} />
          </div>
        </div>
        <div>
          <Label>Risk</Label>
          <select value={node.risk ?? ""} onChange={(e) => onChange({ risk: (e.target.value || null) as TreeNode["risk"] })} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm">
            <option value="">not set</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div>
          <Label>Preconditions</Label>
          <Input value={node.preconditions} onChange={(e) => onChange({ preconditions: e.target.value })} maxLength={500} />
        </div>
        <div>
          <Label hint="Comma-separated references">Evidence</Label>
          <Input value={node.evidenceRefs.join(", ")} onChange={(e) => onChange({ evidenceRefs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) })} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={node.notes} onChange={(e) => onChange({ notes: e.target.value })} maxLength={1000} />
        </div>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete node
        </Button>
      </div>
    </Card>
  );
}

function CritiquePanel({ tree, latest, dirty, actions, onSelectNode }: { tree: ScenarioTree; latest: ScenarioTree["critiques"][number] | null; dirty: boolean; actions: ReturnType<typeof useTreeActions>; onSelectNode: (id: string) => void }) {
  const run = (mode: CritiqueMode) => actions.critique.mutate(mode);
  const visible: CritiqueFinding[] = latest ? (latest.mode === "hints" ? latest.findings.slice(0, latest.shownCount) : latest.mode === "independent" ? latest.findings.filter((f) => f.source === "structural") : latest.findings) : [];
  const hiddenCount = latest ? latest.findings.length - visible.length : 0;
  return (
    <Card>
      <p className="text-xs text-text-muted">Independent: structural checks only. Progressive hints: three findings at a time. Full audit: everything, including the AI auditor's judgement.</p>
      {dirty ? <p className="mt-1 text-xs text-warning">Save first so the critique matches what you see.</p> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" variant="secondary" disabled={dirty} onClick={() => run("independent")} loading={actions.critique.isPending && actions.critique.variables === "independent"}>Independent</Button>
        <Button size="sm" variant="secondary" disabled={dirty} onClick={() => run("hints")} loading={actions.critique.isPending && actions.critique.variables === "hints"}>Hints</Button>
        <Button size="sm" disabled={dirty} onClick={() => run("audit")} loading={actions.critique.isPending && actions.critique.variables === "audit"}>Full audit</Button>
      </div>
      <ErrorNote error={actions.critique.error} />
      {latest ? (
        <div className="mt-3">
          <div className="text-xs text-text-faint">
            {latest.mode} · tree v{latest.treeVersion} · {latest.findings.length} finding{latest.findings.length === 1 ? "" : "s"}{latest.treeVersion !== tree.version ? " · tree has changed since" : ""}
          </div>
          <ul className="mt-2 space-y-2">
            {visible.map((f, i) => (
              <li key={i} className={cx("rounded-lg border p-2 text-xs", f.severity === "critical" ? "border-danger/40" : f.severity === "warning" ? "border-warning/40" : "border-border")}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={f.severity === "critical" ? "danger" : f.severity === "warning" ? "warning" : "neutral"}>{f.kind.replace(/_/g, " ")}</Badge>
                  <span className="text-text-faint">{f.source}</span>
                </div>
                <p className="mt-1">{f.message}</p>
                {f.suggestion ? <p className="mt-1 text-text-muted">{f.suggestion}</p> : null}
                {f.nodeId ? (
                  <button className="mt-1 text-accent" onClick={() => onSelectNode(f.nodeId!)}>
                    Go to node
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {visible.length === 0 ? <p className="mt-2 text-sm text-text-muted">Nothing to show{latest.mode === "hints" ? " yet" : ""}.</p> : null}
          {latest.mode === "hints" && hiddenCount > 0 ? (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => actions.revealMore.mutate(latest.id)} loading={actions.revealMore.isPending}>
              Show {Math.min(3, hiddenCount)} more ({hiddenCount} hidden)
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function VersionsPanel({ tree, current, onRestore }: { tree: ScenarioTree; current: TreeGraph; onRestore: (g: TreeGraph) => void }) {
  return (
    <Card>
      <p className="text-xs text-text-muted">Each save keeps the previous version (last 10). Restore loads an old graph into the editor; nothing changes until you save.</p>
      <ul className="mt-2 divide-y divide-border text-sm">
        {[...tree.history].reverse().map((v) => {
          const d = diffGraphs(v.graph, current);
          return (
            <li key={v.version} className="py-2">
              <div className="flex items-center justify-between">
                <span>
                  v{v.version} · {v.nodeCount} nodes
                </span>
                <Button size="sm" variant="ghost" onClick={() => onRestore(v.graph)}>
                  Restore
                </Button>
              </div>
              <div className="text-xs text-text-faint">
                {new Date(v.savedAt).toLocaleString()} · vs current: +{d.added.length} / −{d.removed.length} / ~{d.changed.length}
              </div>
            </li>
          );
        })}
        {tree.history.length === 0 ? <li className="py-2 text-text-muted">No earlier versions yet.</li> : null}
      </ul>
    </Card>
  );
}
