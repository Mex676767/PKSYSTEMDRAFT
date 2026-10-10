import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type ChallengeStatus = "pending" | "active" | "completed" | "declined";

export type Challenge = {
  id: string;
  creator_id: string;
  opponent_id: string;
  topic: string;
  description: string | null;
  reward: string | null;
  punishment: string | null;
  status: ChallengeStatus;
  score_creator: number;
  score_opponent: number;
  winner_id: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  creator: { username: string | null; role: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null } | null;
  opponent: { username: string | null; role: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null } | null;
};

export function useChallengesList() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: () => apiRequest<Challenge[]>("/challenges"),
    refetchInterval: 30_000,
  });
}

function useInvalidateChallenges() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["challenges"] });
}

export function useRespondChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async ({ challengeId, accept }: { challengeId: string; accept: boolean }) => {
      await apiRequest<void>(`/challenges/${challengeId}/respond`, { method: "PATCH", body: JSON.stringify({ accept }) });
    },
    onSuccess: invalidate,
  });
}

export function useCancelChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      await apiRequest<void>(`/challenges/${challengeId}/cancel`, { method: "POST" });
    },
    onSuccess: invalidate,
  });
}

export function useUpdateChallengeScore() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async ({ challengeId, score }: { challengeId: string; score: number }) => {
      await apiRequest<void>(`/challenges/${challengeId}/score`, { method: "PATCH", body: JSON.stringify({ score }) });
    },
    onSuccess: invalidate,
  });
}

export function useCompleteChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      await apiRequest<void>(`/challenges/${challengeId}/complete`, { method: "POST" });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      await apiRequest<void>(`/challenges/${challengeId}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });
}
