import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

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
  creator: { username: string | null; role: string | null } | null;
  opponent: { username: string | null; role: string | null } | null;
};

// !inner means a challenge disappears entirely if either side is hidden by
// RLS (e.g. deactivated), instead of showing up with a blank participant.
const CHALLENGE_SELECT =
  "*, creator:profiles!challenges_creator_id_fkey!inner(username, role), opponent:profiles!challenges_opponent_id_fkey!inner(username, role)";

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
  const { session } = useAuth();
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (input: {
      opponentId: string;
      topic: string;
      description: string;
      reward: string;
      punishment: string;
      endsAt: string;
    }) => {
      const { error } = await supabase.rpc("create_challenge", {
        opponent_id_param: input.opponentId,
        topic_param: input.topic,
        description_param: input.description,
        reward_param: input.reward,
        punishment_param: input.punishment,
        ends_at_param: input.endsAt,
      });
      if (error) throw error;

      // The RPC itself doesn't hand back the new row, so if a caller needs
      // the id right away (e.g. to attach a photo before this challenge's
      // own ProgressPhotos instance ever mounts) look it up by the unique
      // combination of who just created what, most-recent first. Retried a
      // couple of times -- immediately after the RPC resolves, this select
      // sometimes lands on a pooled connection that hasn't caught up yet and
      // comes back empty even though the insert already committed.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: created, error: lookupError } = await supabase
          .from("challenges")
          .select("id")
          .eq("creator_id", session?.user.id ?? "")
          .eq("opponent_id", input.opponentId)
          .eq("topic", input.topic)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (created) return created as { id: string };
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return null;
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

// Only a finished (declined/completed) challenge can be deleted -- an
// active/pending one should go through cancel/complete instead.
export function useDeleteChallenge() {
  const invalidate = useInvalidateChallenges();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("delete_challenge", { challenge_id_param: challengeId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
