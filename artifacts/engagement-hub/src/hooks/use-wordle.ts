import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type LetterStatus = "correct" | "present" | "absent";

export type WordleAttempt = {
  id: string;
  guess_number: number;
  guess: string;
  statuses: LetterStatus[];
  created_at: string;
};

export type WordleResult = {
  id: string;
  user_id: string;
  solved: boolean;
  guess_count: number;
  duration_seconds: number | null;
};

export type GuessResponse = {
  statuses: LetterStatus[];
  correct: boolean;
  guess_number: number;
  attempts_remaining: number;
  target: string | null;
};

// Today's date as a stable query-key/filter value (recomputed on remount,
// which is fine -- a stale "today" just means a refresh is needed after
// midnight, same as real Wordle).
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodayWordleAttempts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["wordle-attempts", session?.user.id, todayStr()],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wordle_attempts")
        .select("*")
        .eq("user_id", session!.user.id)
        .eq("play_date", todayStr())
        .order("guess_number");
      if (error) throw error;
      return data as WordleAttempt[];
    },
  });
}

export function useTodayWordleResult() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["wordle-result", session?.user.id, todayStr()],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wordle_results")
        .select("*")
        .eq("user_id", session!.user.id)
        .eq("play_date", todayStr())
        .maybeSingle();
      if (error) throw error;
      return data as WordleResult | null;
    },
  });
}

export function useSubmitWordleGuess() {
  const { session, refetchProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guess: string) => {
      const { data, error } = await supabase.rpc("wordle_guess", { guess_word: guess });
      if (error) throw error;
      return data as GuessResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wordle-attempts", session?.user.id, todayStr()] });
      qc.invalidateQueries({ queryKey: ["wordle-result", session?.user.id, todayStr()] });
      qc.invalidateQueries({ queryKey: ["wordle-leaderboard", todayStr()] });
      refetchProfile();
    },
  });
}

export type WordleLeaderboardEntry = {
  user_id: string;
  guess_count: number;
  duration_seconds: number | null;
  profile: { username: string | null } | null;
};

export function useWordleLeaderboard() {
  return useQuery({
    queryKey: ["wordle-leaderboard", todayStr()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wordle_results")
        .select("user_id, guess_count, duration_seconds, profile:profiles(username)")
        .eq("play_date", todayStr())
        .eq("solved", true)
        .order("duration_seconds", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data as unknown as WordleLeaderboardEntry[];
    },
  });
}
