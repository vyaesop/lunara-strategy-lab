import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  MissionDefinition,
  MissionListResponse,
  MissionSessionListResponse,
  MissionSessionView,
  NegotiationListResponse,
  NegotiationSessionListResponse,
  NegotiationSessionView,
  type CreateCustomMissionRequest,
  type Proposal,
} from "@lunara/schemas";
import { api } from "./api";
import { keys as baseKeys } from "./queries";

export const missionKeys = {
  negotiations: ["negotiations"] as const,
  negSessions: ["negotiation-sessions"] as const,
  negSession: (id: string) => ["negotiation-session", id] as const,
  missions: ["missions"] as const,
  missionSessions: ["mission-sessions"] as const,
  missionSession: (id: string) => ["mission-session", id] as const,
};

export function useNegotiations() {
  return useQuery({ queryKey: missionKeys.negotiations, queryFn: () => api("/api/v1/negotiations", { schema: NegotiationListResponse }) });
}
export function useNegotiationSessions() {
  return useQuery({ queryKey: missionKeys.negSessions, queryFn: () => api("/api/v1/negotiation-sessions", { schema: NegotiationSessionListResponse }) });
}
export function useNegotiationSession(id: string) {
  return useQuery({ queryKey: missionKeys.negSession(id), queryFn: () => api(`/api/v1/negotiation-sessions/${id}`, { schema: NegotiationSessionView }) });
}
export function useNegotiationActions(sessionId?: string) {
  const qc = useQueryClient();
  const apply = (view: NegotiationSessionView) => {
    qc.setQueryData(missionKeys.negSession(view.session.id), view);
    void qc.invalidateQueries({ queryKey: missionKeys.negSessions });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  const base = `/api/v1/negotiation-sessions/${sessionId}`;
  return {
    start: useMutation({ mutationFn: (negotiationId: string) => api(`/api/v1/negotiations/${negotiationId}/sessions`, { method: "POST", body: {}, schema: NegotiationSessionView }), onSuccess: apply }),
    prepare: useMutation({ mutationFn: (patch: Record<string, unknown>) => api(`${base}/preparation`, { method: "PATCH", body: patch, schema: NegotiationSessionView }), onSuccess: apply }),
    say: useMutation({ mutationFn: (content: string) => api(`${base}/say`, { method: "POST", body: { content }, schema: NegotiationSessionView }), onSuccess: apply }),
    propose: useMutation({ mutationFn: ({ terms, message }: { terms: Proposal; message: string }) => api(`${base}/propose`, { method: "POST", body: { terms, message }, schema: NegotiationSessionView }), onSuccess: apply }),
    accept: useMutation({ mutationFn: () => api(`${base}/accept`, { method: "POST", body: {}, schema: NegotiationSessionView }), onSuccess: apply }),
    walkAway: useMutation({ mutationFn: () => api(`${base}/walk-away`, { method: "POST", body: {}, schema: NegotiationSessionView }), onSuccess: apply }),
    evaluate: useMutation({ mutationFn: () => api(`${base}/evaluate`, { method: "POST", body: {}, schema: NegotiationSessionView }), onSuccess: apply }),
  };
}

export function useMissions() {
  return useQuery({ queryKey: missionKeys.missions, queryFn: () => api("/api/v1/missions", { schema: MissionListResponse }) });
}
export function useMissionSessions() {
  return useQuery({ queryKey: missionKeys.missionSessions, queryFn: () => api("/api/v1/mission-sessions", { schema: MissionSessionListResponse }) });
}
export function useMissionSession(id: string) {
  return useQuery({ queryKey: missionKeys.missionSession(id), queryFn: () => api(`/api/v1/mission-sessions/${id}`, { schema: MissionSessionView }) });
}
export function useMissionActions(sessionId?: string) {
  const qc = useQueryClient();
  const apply = (view: z.infer<typeof MissionSessionView>) => {
    qc.setQueryData(missionKeys.missionSession(view.session.id), view);
    void qc.invalidateQueries({ queryKey: missionKeys.missionSessions });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  const base = `/api/v1/mission-sessions/${sessionId}`;
  return {
    createCustom: useMutation({ mutationFn: (body: CreateCustomMissionRequest) => api("/api/v1/missions/custom", { method: "POST", body, schema: z.object({ mission: MissionDefinition }) }), onSuccess: () => void qc.invalidateQueries({ queryKey: missionKeys.missions }) }),
    deleteCustom: useMutation({ mutationFn: (id: string) => api(`/api/v1/missions/custom/${id}`, { method: "DELETE" }), onSuccess: () => void qc.invalidateQueries({ queryKey: missionKeys.missions }) }),
    start: useMutation({ mutationFn: (missionId: string) => api(`/api/v1/missions/${missionId}/sessions`, { method: "POST", body: {}, schema: MissionSessionView }), onSuccess: apply }),
    respond: useMutation({ mutationFn: (body: { stepId: string; response: string; refId: string | null }) => api(`${base}/steps`, { method: "POST", body, schema: MissionSessionView }), onSuccess: apply }),
    debrief: useMutation({ mutationFn: () => api(`${base}/debrief`, { method: "POST", body: {}, schema: MissionSessionView }), onSuccess: apply }),
    abandon: useMutation({ mutationFn: () => api(`${base}/abandon`, { method: "POST", body: {}, schema: MissionSessionView }), onSuccess: apply }),
  };
}
