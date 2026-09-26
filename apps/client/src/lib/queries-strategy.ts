import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  BriefingResponse,
  DecisionListResponse,
  DecisionResponse,
  ProjectListResponse,
  ProjectResponse,
  ProjectSuggestResponse,
  type CreateDecisionRequest,
  type ProjectSection,
} from "@lunara/schemas";
import { api } from "./api";
import { keys as baseKeys } from "./queries";

export const strategyKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  journal: ["journal"] as const,
  briefing: ["briefing"] as const,
};

export function useProjects() {
  return useQuery({ queryKey: strategyKeys.projects, queryFn: () => api("/api/v1/projects", { schema: ProjectListResponse }) });
}
export function useProject(id: string) {
  return useQuery({ queryKey: strategyKeys.project(id), queryFn: () => api(`/api/v1/projects/${id}`, { schema: ProjectResponse }) });
}
export function useProjectActions(projectId?: string) {
  const qc = useQueryClient();
  const apply = (data: z.infer<typeof ProjectResponse>) => {
    qc.setQueryData(strategyKeys.project(data.project.id), data);
    void qc.invalidateQueries({ queryKey: strategyKeys.projects });
  };
  const base = `/api/v1/projects/${projectId}`;
  return {
    create: useMutation({ mutationFn: (body: { title: string; summary: string }) => api("/api/v1/projects", { method: "POST", body, schema: ProjectResponse }), onSuccess: apply }),
    update: useMutation({ mutationFn: (patch: Record<string, unknown>) => api(base, { method: "PATCH", body: patch, schema: ProjectResponse }), onSuccess: apply }),
    upsertItem: useMutation({ mutationFn: (body: { section: ProjectSection; id?: string; text: string; status?: "open" | "done" | "dropped"; note?: string }) => api(`${base}/items`, { method: "PUT", body, schema: ProjectResponse }), onSuccess: apply }),
    deleteItem: useMutation({ mutationFn: ({ section, id }: { section: ProjectSection; id: string }) => api(`${base}/items/${section}/${id}`, { method: "DELETE", schema: ProjectResponse }), onSuccess: apply }),
    remove: useMutation({ mutationFn: (id: string) => api(`/api/v1/projects/${id}`, { method: "DELETE" }), onSuccess: () => void qc.invalidateQueries({ queryKey: strategyKeys.projects }) }),
    suggest: useMutation({ mutationFn: () => api(`${base}/suggest`, { method: "POST", body: {}, schema: ProjectSuggestResponse }) }),
  };
}

export function useJournal() {
  return useQuery({ queryKey: strategyKeys.journal, queryFn: () => api("/api/v1/journal", { schema: DecisionListResponse }) });
}
export function useJournalActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: strategyKeys.journal });
    void qc.invalidateQueries({ queryKey: strategyKeys.briefing });
  };
  return {
    create: useMutation({ mutationFn: (body: CreateDecisionRequest) => api("/api/v1/journal", { method: "POST", body, schema: DecisionResponse }), onSuccess: refresh }),
    review: useMutation({ mutationFn: ({ id, actualOutcome, lessons }: { id: string; actualOutcome: string; lessons: string }) => api(`/api/v1/journal/${id}/review`, { method: "POST", body: { actualOutcome, lessons }, schema: DecisionResponse }), onSuccess: refresh }),
    resolve: useMutation({ mutationFn: ({ id, predictionId, resolved, resolutionNote }: { id: string; predictionId: string; resolved: boolean; resolutionNote: string }) => api(`/api/v1/journal/${id}/predictions/${predictionId}/resolve`, { method: "POST", body: { resolved, resolutionNote }, schema: DecisionResponse }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => api(`/api/v1/journal/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}

export function useBriefing() {
  return useQuery({ queryKey: strategyKeys.briefing, queryFn: () => api("/api/v1/briefing/today", { schema: BriefingResponse }) });
}
export function useBriefingActions() {
  const qc = useQueryClient();
  return {
    respond: useMutation({
      mutationFn: ({ date, patch }: { date: string; patch: Record<string, unknown> }) => api(`/api/v1/briefing/${date}/respond`, { method: "POST", body: patch, schema: BriefingResponse }),
      onSuccess: (data) => {
        qc.setQueryData(strategyKeys.briefing, data);
        void qc.invalidateQueries({ queryKey: baseKeys.me });
      },
    }),
  };
}
