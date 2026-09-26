import type { CritiqueFinding, TreeGraph, TreeNode } from "@lunara/schemas";

/**
 * Deterministic structural audit of a scenario tree. These findings are
 * always available; the AI critique adds judgement on top.
 */
export function childrenOf(graph: TreeGraph, nodeId: string): TreeNode[] {
  const ids = graph.edges.filter((e) => e.source === nodeId).map((e) => e.target);
  return graph.nodes.filter((n) => ids.includes(n.id));
}

export function parentsOf(graph: TreeGraph, nodeId: string): TreeNode[] {
  const ids = graph.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return graph.nodes.filter((n) => ids.includes(n.id));
}

export function roots(graph: TreeGraph): TreeNode[] {
  const targets = new Set(graph.edges.map((e) => e.target));
  return graph.nodes.filter((n) => !targets.has(n.id));
}

export function auditTreeStructure(graph: TreeGraph): CritiqueFinding[] {
  const findings: CritiqueFinding[] = [];
  const add = (f: Omit<CritiqueFinding, "source">) => findings.push({ ...f, source: "structural" });
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  if (graph.nodes.length === 0) {
    add({ kind: "structure", severity: "info", nodeId: null, message: "The tree is empty. Start with an objective node.", suggestion: "" });
    return findings;
  }

  const objectives = graph.nodes.filter((n) => n.type === "objective");
  if (objectives.length === 0) {
    add({ kind: "structure", severity: "warning", nodeId: null, message: "No objective node. Every plan should start from what you are trying to achieve.", suggestion: "Add an objective as the root." });
  }
  if (objectives.length > 1) {
    add({ kind: "structure", severity: "info", nodeId: null, message: `${objectives.length} objective nodes. Multiple objectives can be fine, but check they are not competing.`, suggestion: "" });
  }

  // Dangling edges
  for (const e of graph.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      add({ kind: "structure", severity: "critical", nodeId: null, message: `Edge ${e.id} points at a node that does not exist.`, suggestion: "Remove the edge." });
    }
  }

  // Disconnected nodes (excluding a single root)
  const r = roots(graph);
  if (r.length > 1) {
    for (const n of r) {
      if (n.type !== "objective") {
        add({ kind: "structure", severity: "warning", nodeId: n.id, message: `"${n.title}" is not connected to anything above it.`, suggestion: "Connect it to the decision or event it follows, or delete it." });
      }
    }
  }

  for (const n of graph.nodes) {
    const kids = childrenOf(graph, n.id);
    switch (n.type) {
      case "decision": {
        if (kids.length < 2) {
          add({ kind: "missing_branch", severity: "warning", nodeId: n.id, message: `Decision "${n.title}" has ${kids.length} option${kids.length === 1 ? "" : "s"}. A decision with one option is not a decision.`, suggestion: "Add at least one alternative, including 'do nothing' if it is real." });
        }
        const hasOpponent = kids.some((k) => k.type === "opponent_response") || kids.some((k) => childrenOf(graph, k.id).some((g) => g.type === "opponent_response"));
        if (!hasOpponent && kids.length > 0) {
          add({ kind: "unexamined_opponent_response", severity: "warning", nodeId: n.id, message: `No opponent or environmental response is modelled after "${n.title}".`, suggestion: "Ask: what does the other side do in the week after this decision?" });
        }
        break;
      }
      case "opponent_response":
      case "event": {
        if (kids.length === 0) {
          add({ kind: "missing_contingency", severity: "warning", nodeId: n.id, message: `"${n.title}" ends without a response from you.`, suggestion: "Add the decision or contingency that follows." });
        }
        break;
      }
      case "outcome": {
        if (n.type === "outcome" && kids.length === 0 && (n.probability ?? 1) < 1 && n.risk === "high") {
          add({ kind: "unprotected_failure_point", severity: "warning", nodeId: n.id, message: `High-risk outcome "${n.title}" has no contingency attached.`, suggestion: "Add a contingency node describing what you do if this happens." });
        }
        break;
      }
      case "hypothesis": {
        if (n.evidenceRefs.length === 0) {
          add({ kind: "unstated_assumption", severity: "info", nodeId: n.id, message: `Hypothesis "${n.title}" cites no evidence.`, suggestion: "Reference the evidence that supports or contradicts it." });
        }
        break;
      }
      default:
        break;
    }

    // Sibling event probabilities that exceed 1
    const eventKids = kids.filter((k) => (k.type === "event" || k.type === "opponent_response") && k.probability !== null);
    if (eventKids.length >= 2) {
      const sum = eventKids.reduce((a, k) => a + (k.probability ?? 0), 0);
      if (sum > 1.001) {
        add({ kind: "unrealistic_transition", severity: "warning", nodeId: n.id, message: `The probabilities of the ${eventKids.length} alternatives under "${n.title}" add up to ${Math.round(sum * 100)}%.`, suggestion: "If they are mutually exclusive, they should sum to at most 100%." });
      }
    }
  }

  // Leaves that are neither outcomes nor contingencies
  for (const n of graph.nodes) {
    if (childrenOf(graph, n.id).length === 0 && !["outcome", "contingency", "assumption", "hypothesis"].includes(n.type)) {
      add({ kind: "missing_branch", severity: "info", nodeId: n.id, message: `"${n.title}" is a leaf but not an outcome. Where does this branch end?`, suggestion: "Add an outcome node or collapse the branch if it is out of scope." });
    }
  }

  // Assumptions never stated
  const assumptions = graph.nodes.filter((n) => n.type === "assumption");
  const decisions = graph.nodes.filter((n) => n.type === "decision");
  if (decisions.length >= 2 && assumptions.length === 0) {
    add({ kind: "unstated_assumption", severity: "info", nodeId: null, message: "The plan has several decisions but no explicit assumption nodes.", suggestion: "Write down the assumption each key branch depends on." });
  }

  // Information opportunities: decisions under uncertainty with no information action nearby
  const infoActions = graph.nodes.filter((n) => n.type === "information_action").length;
  const uncertainEvents = graph.nodes.filter((n) => (n.type === "event" || n.type === "opponent_response") && n.probability !== null && n.probability > 0.2 && n.probability < 0.8).length;
  if (uncertainEvents >= 2 && infoActions === 0) {
    add({ kind: "information_opportunity", severity: "info", nodeId: null, message: "Several branches hinge on uncertain events, but no information-gathering action is planned.", suggestion: "Is there a cheap way to learn which branch you are on before committing?" });
  }

  return findings;
}

/** Simple diff between two graphs for the version comparison view. */
export function diffGraphs(before: TreeGraph, after: TreeGraph): { added: string[]; removed: string[]; changed: string[] } {
  const b = new Map(before.nodes.map((n) => [n.id, n]));
  const a = new Map(after.nodes.map((n) => [n.id, n]));
  const added = [...a.keys()].filter((id) => !b.has(id));
  const removed = [...b.keys()].filter((id) => !a.has(id));
  const changed = [...a.keys()].filter((id) => {
    const x = b.get(id);
    const y = a.get(id)!;
    if (!x) return false;
    return x.title !== y.title || x.description !== y.description || x.type !== y.type || x.probability !== y.probability;
  });
  return { added, removed, changed };
}
