import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChallengeListResponse, ChallengeView, GameListResponse, GameView, type ChallengeStageRequest, type GameTurnInput } from "@lunara/schemas";
import { api } from "./api";
import { keys as baseKeys } from "./queries";

export const gameKeys = {
  games: ["games"] as const,
  game: (id: string) => ["game", id] as const,
  challenges: ["challenges"] as const,
  attempt: (id: string) => ["challenge-attempt", id] as const,
};

export function useGames() {
  return useQuery({ queryKey: gameKeys.games, queryFn: () => api("/api/v1/game", { schema: GameListResponse }) });
}
export function useGame(id: string) {
  return useQuery({ queryKey: gameKeys.game(id), queryFn: () => api(`/api/v1/game/${id}`, { schema: GameView }) });
}
export function useGameActions(gameId?: string) {
  const qc = useQueryClient();
  const apply = (view: GameView) => {
    qc.setQueryData(gameKeys.game(view.session.id), view);
    void qc.invalidateQueries({ queryKey: gameKeys.games });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  return {
    create: useMutation({ mutationFn: () => api("/api/v1/game", { method: "POST", body: {}, schema: GameView }), onSuccess: apply }),
    turn: useMutation({ mutationFn: (input: GameTurnInput) => api(`/api/v1/game/${gameId}/turn`, { method: "POST", body: input, schema: GameView }), onSuccess: apply }),
    evaluate: useMutation({ mutationFn: () => api(`/api/v1/game/${gameId}/evaluate`, { method: "POST", body: {}, schema: GameView }), onSuccess: apply }),
    abandon: useMutation({ mutationFn: () => api(`/api/v1/game/${gameId}/abandon`, { method: "POST", body: {}, schema: GameView }), onSuccess: apply }),
  };
}

export function useChallenges() {
  return useQuery({ queryKey: gameKeys.challenges, queryFn: () => api("/api/v1/challenges", { schema: ChallengeListResponse }) });
}
export function useAttempt(id: string) {
  return useQuery({ queryKey: gameKeys.attempt(id), queryFn: () => api(`/api/v1/challenges/attempts/${id}`, { schema: ChallengeView }) });
}
export function useChallengeActions(attemptId?: string) {
  const qc = useQueryClient();
  const apply = (view: ChallengeView) => {
    qc.setQueryData(gameKeys.attempt(view.attempt.id), view);
    void qc.invalidateQueries({ queryKey: gameKeys.challenges });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  return {
    start: useMutation({ mutationFn: (challengeId: string) => api(`/api/v1/challenges/${challengeId}/attempts`, { method: "POST", body: {}, schema: ChallengeView }), onSuccess: apply }),
    submit: useMutation({ mutationFn: (body: ChallengeStageRequest) => api(`/api/v1/challenges/attempts/${attemptId}/stage`, { method: "POST", body, schema: ChallengeView }), onSuccess: apply }),
    abandon: useMutation({ mutationFn: () => api(`/api/v1/challenges/attempts/${attemptId}/abandon`, { method: "POST", body: {}, schema: ChallengeView }), onSuccess: apply }),
  };
}
