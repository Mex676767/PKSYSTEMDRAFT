import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodayWordleAttempts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["wordle-attempts", session?.user.id, todayStr()],
    enabled: !!session,
    queryFn: () => apiRequest<WordleAttempt[]>("/wordle/attempts/today"),
  });
}

export function useTodayWordleResult() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["wordle-result", session?.user.id, todayStr()],
    enabled: !!session,
    queryFn: () => apiRequest<WordleResult | null>("/wordle/result/today"),
  });
}

export function useSubmitWordleGuess() {
  const { session, refetchProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guess: string) => apiRequest<GuessResponse>("/wordle/guess", { method: "POST", body: JSON.stringify({ guess }) }),
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
    queryFn: () => apiRequest<WordleLeaderboardEntry[]>("/wordle/leaderboard"),
  });
}
