import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("*, creator:profiles(username)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Bet[];
    },
  });
}

export function useBetOptions() {
  return useQuery({
    queryKey: ["bet-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bet_options").select("*");
      if (error) throw error;
      return data as BetOption[];
    },
  });
}

export function useBetWagers() {
  return useQuery({
    queryKey: ["bet-wagers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bet_wagers")
        .select("*, user:profiles(username)");
      if (error) throw error;
      return data as unknown as BetWager[];
    },
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
      const { error } = await supabase.rpc("create_bet", {
        title_param: title,
        options_param: options,
        closes_at_param: closesAt ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function usePlaceWager() {
  const invalidate = useInvalidateBets();
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ betId, optionId, amount }: { betId: string; optionId: string; amount: number }) => {
      const { error } = await supabase.rpc("place_wager", {
        bet_id_param: betId,
        option_id_param: optionId,
        amount_param: amount,
      });
      if (error) throw error;
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
      const { error } = await supabase.rpc("resolve_bet", {
        bet_id_param: betId,
        winning_option_id_param: winningOptionId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCancelBet() {
  const invalidate = useInvalidateBets();
  return useMutation({
    mutationFn: async (betId: string) => {
      const { error } = await supabase.rpc("cancel_bet", { bet_id_param: betId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
