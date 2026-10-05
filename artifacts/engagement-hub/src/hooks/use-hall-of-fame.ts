import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type HofPodiumEntry = {
  rank: number;
  user_id: string;
  username: string | null;
  role?: string | null;
  avatar_url: string | null;
  active_border: string | null; active_accessory?: string | null;
  achievement: string;
  team_members?: HofTeamMember[];
};
export type HofTeamMember = {
  user_id: string;
  username: string | null;
};
export type AwardCategory = {
  id: string;
  department: string;
  name: string;
  award_type: "individual" | "team";
};
export type AwardWinner = {
  id: string;
  category_id: string;
  month: string;
  rank: number;
  user_id: string;
  achievement: string;
  team_member_ids: string[];
  team_members: HofTeamMember[];
  holder: {
    username: string | null;
    role: string | null;
    avatar_url: string | null;
    active_border: string | null; active_accessory?: string | null;
  } | null;
};
export type WinnerInput = {
  rank: number;
  user_id: string;
  achievement: string;
  team_member_ids: string[];
};
export type DeletionLog = {
  id: string;
  deleted_at: string;
  deleted_by_name: string | null;
  entity_type: string;
  entity_id: string;
  snapshot: Record<string, unknown>;
};

export type HofDepartmentVisibility = {
  name: string;
  show_in_hall_of_fame: boolean;
};

export function useAwardCategories(department: string) {
  return useQuery({
    queryKey: ["hof-award-categories", department],
    enabled: Boolean(department),
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

export function useHofDepartmentVisibility() {
  return useQuery({
    queryKey: ["hof-department-visibility"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_departments")
        .select("name, show_in_hall_of_fame")
        .order("sort");

      if (error) {
        // Keep the Hall of Fame usable while migration 0050 is being applied.
        if (
          error.message.includes("show_in_hall_of_fame")
        ) {
          return { configured: false, departments: [] as HofDepartmentVisibility[] };
        }
        throw error;
      }

      return {
        configured: true,
        departments: (data ?? []) as HofDepartmentVisibility[],
      };
    },
  });
}

export function useSetHofDepartmentVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ department, visible }: { department: string; visible: boolean }) => {
      const { error } = await supabase.rpc("admin_set_hof_department_visibility", {
        department_name: department,
        visible,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hof-department-visibility"] }),
  });
}
export function useAwardWinners(month: string) {
  return useQuery({
    queryKey: ["hof-award-winners", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_award_winners")
        .select("*, holder:profiles!user_id(username,role,avatar_url,active_border,active_accessory)")
        .eq("month", month)
        .order("rank");
      if (error) throw error;
      const rows = data as unknown as (Omit<AwardWinner, "team_members"> & { team_members?: HofTeamMember[] })[];
      const memberIds = [...new Set(rows.flatMap((winner) => winner.team_member_ids ?? []))];
      if (memberIds.length === 0) {
        return rows.map((winner) => ({ ...winner, team_member_ids: winner.team_member_ids ?? [], team_members: [] })) as AwardWinner[];
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", memberIds);
      if (profileError) throw profileError;

      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return rows.map((winner) => ({
        ...winner,
        team_member_ids: winner.team_member_ids ?? [],
        team_members: (winner.team_member_ids ?? []).flatMap((user_id) => {
          const profile = profileById.get(user_id);
          return profile ? [{ user_id, username: profile.username }] : [];
        }),
      })) as AwardWinner[];
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
        | { type: "category"; id?: string; department: string; name: string; award_type: "individual" | "team" }
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
          award_type: action.award_type,
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
