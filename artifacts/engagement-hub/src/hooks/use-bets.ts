import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export type BetStatus = "open" | "resolved" | "cancelled";

export type Bet = {
  id: string;
  creator_id: string;
  title: string;
  status: BetStatus;
  winning_option_id: string | null;
  closes_at: string | null;
  created_at: string;
  creator: { username: string | null } | null;
};

export type BetOption = {
  id: string;
  bet_id: string;
  label: string;
};

export type BetWager = {
  id: string;
  bet_id: string;
  option_id: string;
  user_id: string;
  amount: number;
  user: { username: string | null } | null;
};

export function useBets() {
  return useQuery({
    queryKey: ["bets"],
    queryFn: () => apiRequest<Bet[]>("/bets"),
  });
}

export function useBetOptions() {
  return useQuery({
    queryKey: ["bet-options"],
    queryFn: () => apiRequest<BetOption[]>("/bets/options"),
  });
}

export function useBetWagers() {
  return useQuery({
    queryKey: ["bet-wagers"],
    queryFn: () => apiRequest<BetWager[]>("/bets/wagers"),
  });
}

function useInvalidateBets() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["bets"] });
    qc.invalidateQueries({ queryKey: ["bet-options"] });
    qc.invalidateQueries({ queryKey: ["bet-wagers"] });
  };
}

export function useCreateBet() {
  const invalidate = useInvalidateBets();
  return useMutation({
    mutationFn: async ({ title, options, closesAt }: { title: string; options: string[]; closesAt?: string | null }) => {
      await apiRequest<void>("/bets", { method: "POST", body: JSON.stringify({ title, options, closes_at: closesAt ?? null }) });
    },
    onSuccess: invalidate,
  });
}

export function usePlaceWager() {
  const invalidate = useInvalidateBets();
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ betId, optionId, amount }: { betId: string; optionId: string; amount: number }) => {
      await apiRequest<void>(`/bets/${betId}/wagers`, { method: "POST", body: JSON.stringify({ option_id: optionId, amount }) });
    },
    onSuccess: () => {
      invalidate();
      refetchProfile();
    },
  });
}

export function useResolveBet() {
  const invalidate = useInvalidateBets();
  return useMutation({
    mutationFn: async ({ betId, winningOptionId }: { betId: string; winningOptionId: string }) => {
      await apiRequest<void>(`/bets/${betId}/resolve`, { method: "POST", body: JSON.stringify({ winning_option_id: winningOptionId }) });
    },
    onSuccess: invalidate,
  });
}

export function useCancelBet() {
  const invalidate = useInvalidateBets();
  return useMutation({
    mutationFn: async (betId: string) => {
      await apiRequest<void>(`/bets/${betId}/cancel`, { method: "POST" });
    },
    onSuccess: invalidate,
  });
}
