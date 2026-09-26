import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CritiqueTreeResponse,
  InvestigationListResponse,
  InvestigationSessionListResponse,
  InvestigationSessionView,
  TreeListResponse,
  TreeResponse,
  type ConcludeRequest,
  type CritiqueMode,
  type SaveTreeRequest,
  type UpsertInvestigationHypothesisRequest,
} from "@lunara/schemas";
import { api } from "./api";
import { keys as baseKeys } from "./queries";

export const labKeys = {
  investigations: ["investigations"] as const,
  investigationSessions: ["investigation-sessions"] as const,
  investigationSession: (id: string) => ["investigation-session", id] as const,
  trees: ["trees"] as const,
  tree: (id: string) => ["tree", id] as const,
};

export function useInvestigations() {
  return useQuery({ queryKey: labKeys.investigations, queryFn: () => api("/api/v1/investigations", { schema: InvestigationListResponse }) });
}

export function useInvestigationSessions() {
  return useQuery({ queryKey: labKeys.investigationSessions, queryFn: () => api("/api/v1/investigation-sessions", { schema: InvestigationSessionListResponse }) });
}

export function useInvestigationSession(id: string) {
  return useQuery({ queryKey: labKeys.investigationSession(id), queryFn: () => api(`/api/v1/investigation-sessions/${id}`, { schema: InvestigationSessionView }) });
}

export function useStartInvestigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (investigationId: string) => api(`/api/v1/investigations/${investigationId}/sessions`, { method: "POST", body: {}, schema: InvestigationSessionView }),
    onSuccess: (view) => {
      qc.setQueryData(labKeys.investigationSession(view.session.id), view);
      void qc.invalidateQueries({ queryKey: labKeys.investigationSessions });
    },
  });
}

export function useInvestigationActions(sessionId: string) {
  const qc = useQueryClient();
  const base = `/api/v1/investigation-sessions/${sessionId}`;
  const apply = (view: InvestigationSessionView) => {
    qc.setQueryData(labKeys.investigationSession(sessionId), view);
    void qc.invalidateQueries({ queryKey: labKeys.investigationSessions });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  return {
    act: useMutation({ mutationFn: (actionId: string) => api(`${base}/actions`, { method: "POST", body: { actionId }, schema: InvestigationSessionView }), onSuccess: apply }),
    addHypothesis: useMutation({ mutationFn: (body: UpsertInvestigationHypothesisRequest) => api(`${base}/hypotheses`, { method: "POST", body, schema: InvestigationSessionView }), onSuccess: apply }),
    updateHypothesis: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<UpsertInvestigationHypothesisRequest> }) => api(`${base}/hypotheses/${id}`, { method: "PATCH", body: patch, schema: InvestigationSessionView }),
      onSuccess: apply,
    }),
    discardHypothesis: useMutation({ mutationFn: (id: string) => api(`${base}/hypotheses/${id}`, { method: "DELETE", schema: InvestigationSessionView }), onSuccess: apply }),
    hint: useMutation({ mutationFn: () => api(`${base}/hint`, { method: "POST", body: {}, schema: InvestigationSessionView }), onSuccess: apply }),
    conclude: useMutation({ mutationFn: (body: ConcludeRequest) => api(`${base}/conclude`, { method: "POST", body, schema: InvestigationSessionView }), onSuccess: apply }),
    evaluate: useMutation({ mutationFn: () => api(`${base}/evaluate`, { method: "POST", body: {}, schema: InvestigationSessionView }), onSuccess: apply }),
    abandon: useMutation({ mutationFn: () => api(`${base}/abandon`, { method: "POST", body: {}, schema: InvestigationSessionView }), onSuccess: apply }),
  };
}

// ── Trees ───────────────────────────────────────────────────────────────────

export function useTrees() {
  return useQuery({ queryKey: labKeys.trees, queryFn: () => api("/api/v1/trees", { schema: TreeListResponse }) });
}

export function useTree(id: string) {
  return useQuery({ queryKey: labKeys.tree(id), queryFn: () => api(`/api/v1/trees/${id}`, { schema: TreeResponse }) });
}

export function useTreeActions(treeId?: string) {
  const qc = useQueryClient();
  const applyTree = (data: TreeResponse) => {
    qc.setQueryData(labKeys.tree(data.tree.id), data);
    void qc.invalidateQueries({ queryKey: labKeys.trees });
  };
  return {
    create: useMutation({
      mutationFn: (body: { title: string; objective?: string }) => api("/api/v1/trees", { method: "POST", body, schema: TreeResponse }),
      onSuccess: applyTree,
    }),
    save: useMutation({
      mutationFn: (body: SaveTreeRequest) => api(`/api/v1/trees/${treeId}`, { method: "PUT", body, schema: TreeResponse }),
      onSuccess: applyTree,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/api/v1/trees/${id}`, { method: "DELETE" }),
      onSuccess: () => void qc.invalidateQueries({ queryKey: labKeys.trees }),
    }),
    critique: useMutation({
      mutationFn: (mode: CritiqueMode) => api(`/api/v1/trees/${treeId}/critique`, { method: "POST", body: { mode }, schema: CritiqueTreeResponse }),
      onSuccess: (data) => applyTree({ tree: data.tree }),
    }),
    revealMore: useMutation({
      mutationFn: (critiqueId: string) => api(`/api/v1/trees/${treeId}/critiques/${critiqueId}/reveal`, { method: "POST", body: { count: 3 }, schema: TreeResponse }),
      onSuccess: applyTree,
    }),
  };
}
