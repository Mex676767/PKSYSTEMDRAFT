import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type HofPodiumEntry = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  active_border: string | null; active_accessory?: string | null;
  achievement: string;
};
export type AwardCategory = { id: string; department: string; name: string };
export type AwardWinner = {
  id: string;
  category_id: string;
  month: string;
  rank: number;
  user_id: string;
  achievement: string;
  holder: {
    username: string | null;
    avatar_url: string | null;
    active_border: string | null; active_accessory?: string | null;
  } | null;
};
export type WinnerInput = {
  rank: number;
  user_id: string;
  achievement: string;
};
export type DeletionLog = {
  id: string;
  deleted_at: string;
  deleted_by_name: string | null;
  entity_type: string;
  entity_id: string;
  snapshot: Record<string, unknown>;
};

export function useAwardCategories(department: string) {
  return useQuery({
    queryKey: ["hof-award-categories", department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_award_categories")
        .select("*")
        .eq("department", department)
        .order("created_at");
      if (error) throw error;
      return data as AwardCategory[];
    },
  });
}
export function useAwardWinners(month: string) {
  return useQuery({
    queryKey: ["hof-award-winners", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_award_winners")
        .select("*, holder:profiles!user_id(username,avatar_url,active_border, active_accessory)")
        .eq("month", month)
        .order("rank");
      if (error) throw error;
      return data as unknown as AwardWinner[];
    },
  });
}
export function useDeletionLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["hof-deletion-logs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_deletion_logs")
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as DeletionLog[];
    },
  });
}
export function useManageAwards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      action:
        | { type: "category"; id?: string; department: string; name: string }
        | { type: "delete"; id: string }
        | {
            type: "winners";
            id: string;
            month: string;
            winners: WinnerInput[];
          },
    ) => {
      if (action.type === "winners") {
        const { error } = await supabase.rpc("hof_save_winners", {
          target_category: action.id,
          target_month: action.month,
          winners: action.winners,
        });
        if (error) throw error;
      } else if (action.type === "delete") {
        const { data, error } = await supabase
          .from("hof_award_categories")
          .delete()
          .eq("id", action.id)
          .select("id");
        if (error) throw error;
        if (!data?.length)
          throw new Error(
            "Category could not be deleted. Check your permissions or refresh.",
          );
      } else {
        const values = {
          department: action.department,
          name: action.name.trim(),
        };
        const query = action.id
          ? supabase
              .from("hof_award_categories")
              .update(values)
              .eq("id", action.id)
          : supabase.from("hof_award_categories").insert(values);
        const { error } = await query.select("id").single();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-award-categories"] });
      qc.invalidateQueries({ queryKey: ["hof-award-winners"] });
      qc.invalidateQueries({ queryKey: ["hof-deletion-logs"] });
    },
  });
}
