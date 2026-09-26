import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ExerciseListResponse,
  MeResponse,
  ProfileResponse,
  RecommendationResponse,
  SessionListResponse,
  SessionMutationResponse,
  SessionResponse,
  SessionTurnResponse,
  type CompleteOnboardingRequest,
  type SessionPhase,
  type SubmitDecisionRequest,
  type SubmitHypothesisRequest,
  type UpdatePreferencesRequest,
} from "@lunara/schemas";
import { api } from "./api";

export const Released = z.object({
  hints: z.array(z.string()),
  solution: z.string().nullable(),
  keyInsights: z.array(z.string()).nullable(),
  debrief: z.string().nullable(),
});
export const SessionDetail = SessionResponse.extend({ released: Released });
export type SessionDetail = z.infer<typeof SessionDetail>;
const SessionWithReleased = z.object({ session: SessionResponse.shape.session, released: Released });

export const keys = {
  me: ["me"] as const,
  exercises: ["exercises"] as const,
  sessions: ["sessions"] as const,
  recommendations: ["recommendations"] as const,
  session: (id: string) => ["session", id] as const,
};

export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => api("/api/v1/me", { schema: MeResponse }), enabled, retry: false });
}

export function useExercises() {
  return useQuery({ queryKey: keys.exercises, queryFn: () => api("/api/v1/exercises", { schema: ExerciseListResponse }) });
}

export function useRecommendations() {
  return useQuery({ queryKey: keys.recommendations, queryFn: () => api("/api/v1/recommendations", { schema: RecommendationResponse }) });
}

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => api("/api/v1/sessions", { schema: SessionListResponse }) });
}

export function useSession(id: string) {
  return useQuery({ queryKey: keys.session(id), queryFn: () => api(`/api/v1/sessions/${id}`, { schema: SessionDetail }) });
}

/** Apply the returned profile synchronously so route guards see fresh state before the refetch lands. */
function useProfileMutation<TInput>(mutationFn: (input: TInput) => Promise<ProfileResponse>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      qc.setQueryData<MeResponse>(keys.me, (old) => (old ? { ...old, profile: data.profile } : old));
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useUpdatePreferences() {
  return useProfileMutation((patch: UpdatePreferencesRequest) =>
    api("/api/v1/me/preferences", { method: "PATCH", body: patch, schema: ProfileResponse }),
  );
}

export function useCompleteOnboarding() {
  return useProfileMutation((body: CompleteOnboardingRequest) =>
    api("/api/v1/me/onboarding", { method: "POST", body, schema: ProfileResponse }),
  );
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => api("/api/v1/sessions", { method: "POST", body: { exerciseId }, schema: SessionDetail }),
    onSuccess: (data) => {
      qc.setQueryData(keys.session(data.session.id), data);
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** All session mutations refresh the detail query so phase state always comes from the server. */
export function useSessionActions(sessionId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.session(sessionId) });
    void qc.invalidateQueries({ queryKey: keys.sessions });
    void qc.invalidateQueries({ queryKey: keys.recommendations });
    void qc.invalidateQueries({ queryKey: keys.me });
  };
  const base = `/api/v1/sessions/${sessionId}`;
  return {
    sendMessage: useMutation({
      mutationFn: (content: string) => api(`${base}/messages`, { method: "POST", body: { content }, schema: SessionTurnResponse }),
      onSettled: refresh,
    }),
    addHypothesis: useMutation({
      mutationFn: (body: SubmitHypothesisRequest) => api(`${base}/hypotheses`, { method: "POST", body, schema: SessionMutationResponse }),
      onSuccess: refresh,
    }),
    discardHypothesis: useMutation({
      mutationFn: (hypothesisId: string) => api(`${base}/hypotheses/${hypothesisId}`, { method: "DELETE", schema: SessionMutationResponse }),
      onSuccess: refresh,
    }),
    hint: useMutation({
      mutationFn: () => api(`${base}/hint`, { method: "POST", body: {} }),
      onSettled: refresh,
    }),
    reveal: useMutation({
      mutationFn: () => api(`${base}/reveal`, { method: "POST", body: {}, schema: SessionWithReleased }),
      onSettled: refresh,
    }),
    decide: useMutation({
      mutationFn: (body: SubmitDecisionRequest) => api(`${base}/decision`, { method: "POST", body, schema: SessionWithReleased }),
      onSettled: refresh,
    }),
    assess: useMutation({
      mutationFn: () => api(`${base}/assess`, { method: "POST", body: {}, schema: SessionMutationResponse.extend({ skills: z.array(z.unknown()) }) }),
      onSettled: refresh,
    }),
    advance: useMutation({
      mutationFn: (to: SessionPhase) => api(`${base}/advance`, { method: "POST", body: { to }, schema: SessionWithReleased }),
      onSettled: refresh,
    }),
    abandon: useMutation({
      mutationFn: () => api(`${base}/abandon`, { method: "POST", body: {}, schema: SessionMutationResponse }),
      onSettled: refresh,
    }),
  };
}
