import { describe, expect, it } from "vitest";
import type { TreeGraph, TreeNode } from "@lunara/schemas";
import { auditTreeStructure, diffGraphs } from "./audit";

const node = (id: string, type: TreeNode["type"], extra: Partial<TreeNode> = {}): TreeNode => ({
  id, type, title: id, description: "", preconditions: "", probability: null, cost: "", time: "", risk: null, evidenceRefs: [], notes: "", position: { x: 0, y: 0 }, collapsed: false, ...extra,
});
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target, label: "" });

describe("auditTreeStructure", () => {
  it("flags an empty tree and missing objective", () => {
    expect(auditTreeStructure({ nodes: [], edges: [] })[0]!.kind).toBe("structure");
    const f = auditTreeStructure({ nodes: [node("d", "decision")], edges: [] });
    expect(f.some((x) => x.message.includes("No objective"))).toBe(true);
  });

  it("flags one-option decisions and missing opponent responses", () => {
    const g: TreeGraph = { nodes: [node("obj", "objective"), node("d", "decision"), node("o", "outcome")], edges: [edge("obj", "d"), edge("d", "o")] };
    const f = auditTreeStructure(g);
    expect(f.some((x) => x.kind === "missing_branch" && x.nodeId === "d")).toBe(true);
    expect(f.some((x) => x.kind === "unexamined_opponent_response")).toBe(true);
  });

  it("is quiet on a well-formed branch", () => {
    const g: TreeGraph = {
      nodes: [node("obj", "objective"), node("d", "decision"), node("r1", "opponent_response", { probability: 0.6 }), node("r2", "opponent_response", { probability: 0.4 }), node("c", "contingency"), node("o1", "outcome"), node("o2", "outcome")],
      edges: [edge("obj", "d"), edge("d", "r1"), edge("d", "r2"), edge("r1", "o1"), edge("r2", "c"), edge("c", "o2")],
    };
    const f = auditTreeStructure(g).filter((x) => x.severity !== "info");
    expect(f).toEqual([]);
  });

  it("flags probabilities above 100% and unattached high-risk outcomes", () => {
    const g: TreeGraph = {
      nodes: [node("obj", "objective"), node("d", "decision"), node("e1", "event", { probability: 0.7 }), node("e2", "event", { probability: 0.6 }), node("bad", "outcome", { risk: "high", probability: 0.5 }), node("ok", "outcome")],
      edges: [edge("obj", "d"), edge("d", "e1"), edge("d", "e2"), edge("e1", "bad"), edge("e2", "ok")],
    };
    const f = auditTreeStructure(g);
    expect(f.some((x) => x.kind === "unrealistic_transition")).toBe(true);
    expect(f.some((x) => x.kind === "unprotected_failure_point" && x.nodeId === "bad")).toBe(true);
  });

  it("flags dangling edges as critical", () => {
    const f = auditTreeStructure({ nodes: [node("obj", "objective")], edges: [edge("obj", "ghost")] });
    expect(f.some((x) => x.severity === "critical")).toBe(true);
  });
});

describe("diffGraphs", () => {
  it("reports added, removed and changed nodes", () => {
    const before: TreeGraph = { nodes: [node("a", "objective"), node("b", "decision")], edges: [] };
    const after: TreeGraph = { nodes: [node("a", "objective", { title: "A2" }), node("c", "outcome")], edges: [] };
    expect(diffGraphs(before, after)).toEqual({ added: ["c"], removed: ["b"], changed: ["a"] });
  });
});
