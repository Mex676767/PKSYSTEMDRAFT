import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ChallengeStatus = "pending" | "active" | "completed" | "declined";

export type Challenge = {
  id: string;
  creator_id: string;
  opponent_id: string;
  topic: string;
  description: string | null;
  reward: string | null;
  punishment: string | null;
  metric: string;
  status: ChallengeStatus;
  score_creator: number;
  score_opponent: number;
  winner_id: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  creator: { username: string | null; role: string | null } | null;
  opponent: { username: string | null; role: string | null } | null;
};

const CHALLENGE_SELECT =
  "*, creator:profiles!challenges_creator_id_fkey(username, role), opponent:profiles!challenges_opponent_id_fkey(username, role)";

export function useChallengesList() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(CHALLENGE_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Challenge[];
    },
  });
}

function useInvalidateChallenges() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["challenges"] });
}

export function useCreateChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (input: {
      opponentId: string;
      topic: string;
      description: string;
      reward: string;
      punishment: string;
      metric: string;
      endsAt: string;
    }) => {
      const { error } = await supabase.rpc("create_challenge", {
        opponent_id_param: input.opponentId,
        topic_param: input.topic,
        description_param: input.description,
        reward_param: input.reward,
        punishment_param: input.punishment,
        metric_param: input.metric,
        ends_at_param: input.endsAt,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRespondChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async ({ challengeId, accept }: { challengeId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_challenge", { challenge_id_param: challengeId, accept });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCancelChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("cancel_challenge", { challenge_id_param: challengeId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateChallengeScore() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async ({ challengeId, score }: { challengeId: string; score: number }) => {
      const { error } = await supabase.rpc("update_challenge_score", {
        challenge_id_param: challengeId,
        score_param: score,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("complete_challenge", { challenge_id_param: challengeId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
