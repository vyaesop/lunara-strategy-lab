import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CouncilListResponse,
  CouncilResponse,
  SimulationListResponse,
  SimulationSessionListResponse,
  SimulationSessionView,
  type CouncilAskRequest,
  type CouncilDecideRequest,
  type CreateCouncilRequest,
  type SimDecideRequest,
} from "@lunara/schemas";
import { api } from "./api";
import { keys as baseKeys } from "./queries";

export const simKeys = {
  simulations: ["simulations"] as const,
  simSessions: ["simulation-sessions"] as const,
  simSession: (id: string) => ["simulation-session", id] as const,
  councils: ["councils"] as const,
  council: (id: string) => ["council", id] as const,
};

export function useSimulations() {
  return useQuery({ queryKey: simKeys.simulations, queryFn: () => api("/api/v1/simulations", { schema: SimulationListResponse }) });
}
export function useSimSessions() {
  return useQuery({ queryKey: simKeys.simSessions, queryFn: () => api("/api/v1/simulation-sessions", { schema: SimulationSessionListResponse }) });
}
export function useSimSession(id: string) {
  return useQuery({ queryKey: simKeys.simSession(id), queryFn: () => api(`/api/v1/simulation-sessions/${id}`, { schema: SimulationSessionView }) });
}
export function useStartSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (simulationId: string) => api(`/api/v1/simulations/${simulationId}/sessions`, { method: "POST", body: {}, schema: SimulationSessionView }),
    onSuccess: (view) => {
      qc.setQueryData(simKeys.simSession(view.session.id), view);
      void qc.invalidateQueries({ queryKey: simKeys.simSessions });
    },
  });
}
export function useSimActions(sessionId: string) {
  const qc = useQueryClient();
  const base = `/api/v1/simulation-sessions/${sessionId}`;
  const apply = (view: SimulationSessionView) => {
    qc.setQueryData(simKeys.simSession(sessionId), view);
    void qc.invalidateQueries({ queryKey: simKeys.simSessions });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  return {
    decide: useMutation({ mutationFn: (body: SimDecideRequest) => api(`${base}/decide`, { method: "POST", body, schema: SimulationSessionView }), onSuccess: apply }),
    evaluate: useMutation({ mutationFn: () => api(`${base}/evaluate`, { method: "POST", body: {}, schema: SimulationSessionView }), onSuccess: apply }),
    abandon: useMutation({ mutationFn: () => api(`${base}/abandon`, { method: "POST", body: {}, schema: SimulationSessionView }), onSuccess: apply }),
  };
}

export function useCouncils() {
  return useQuery({ queryKey: simKeys.councils, queryFn: () => api("/api/v1/council", { schema: CouncilListResponse }) });
}
export function useCouncil(id: string) {
  return useQuery({ queryKey: simKeys.council(id), queryFn: () => api(`/api/v1/council/${id}`, { schema: CouncilResponse }) });
}
export function useCouncilActions(councilId?: string) {
  const qc = useQueryClient();
  const apply = (data: CouncilResponse) => {
    qc.setQueryData(simKeys.council(data.council.id), data);
    void qc.invalidateQueries({ queryKey: simKeys.councils });
  };
  const base = `/api/v1/council/${councilId}`;
  return {
    convene: useMutation({ mutationFn: (body: CreateCouncilRequest) => api("/api/v1/council", { method: "POST", body, schema: CouncilResponse }), onSuccess: apply }),
    rerun: useMutation({ mutationFn: () => api(`${base}/run`, { method: "POST", body: {}, schema: CouncilResponse }), onSuccess: apply }),
    ask: useMutation({ mutationFn: (body: CouncilAskRequest) => api(`${base}/ask`, { method: "POST", body, schema: CouncilResponse }), onSuccess: apply }),
    decide: useMutation({ mutationFn: (body: CouncilDecideRequest) => api(`${base}/decision`, { method: "POST", body, schema: CouncilResponse }), onSuccess: apply }),
  };
}
