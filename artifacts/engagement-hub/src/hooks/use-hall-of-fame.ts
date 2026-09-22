import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

export type HofPodiumEntry = {
  department: string;
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  active_border: string | null;
  total_points: number;
};

export function useMonthlyPodium(monthStart: Date) {
  const monthKey = format(monthStart, "yyyy-MM-01");
  return useQuery({
    queryKey: ["hof-monthly-podium", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("hof_monthly_podium", { target_month: monthKey });
      if (error) throw error;
      return data as HofPodiumEntry[];
    },
  });
}

export type HofExcludedUser = { user_id: string; username: string | null; avatar_url: string | null };

export function useHofExclusions() {
  return useQuery({
    queryKey: ["hof-podium-exclusions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_podium_exclusions")
        .select("user_id, profile:profiles!user_id(username, avatar_url)");
      if (error) throw error;
      return (data as unknown as { user_id: string; profile: { username: string | null; avatar_url: string | null } | null }[]).map(
        (row) => ({ user_id: row.user_id, username: row.profile?.username ?? null, avatar_url: row.profile?.avatar_url ?? null })
      );
    },
  });
}

export function useSetHofPodiumExclusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, excluded }: { userId: string; excluded: boolean }) => {
      const { error } = await supabase.rpc("hof_set_podium_exclusion", { target_user: userId, excluded });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-podium-exclusions"] });
      qc.invalidateQueries({ queryKey: ["hof-monthly-podium"] });
    },
  });
}
