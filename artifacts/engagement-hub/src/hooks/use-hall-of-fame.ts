import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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
    queryFn: () => apiRequest<AwardCategory[]>(`/hall-of-fame/award-categories?department=${encodeURIComponent(department)}`),
  });
}

export function useHofDepartmentVisibility() {
  return useQuery({
    queryKey: ["hof-department-visibility"],
    queryFn: () => apiRequest<{ configured: boolean; departments: HofDepartmentVisibility[] }>("/hall-of-fame/departments"),
  });
}

export function useSetHofDepartmentVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ department, visible }: { department: string; visible: boolean }) =>
      apiRequest(`/hall-of-fame/departments/${encodeURIComponent(department)}/visibility`, {
        method: "PUT", body: JSON.stringify({ visible }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hof-department-visibility"] }),
  });
}
export function useAwardWinners(month: string) {
  return useQuery({
    queryKey: ["hof-award-winners", month],
    queryFn: () => apiRequest<AwardWinner[]>(`/hall-of-fame/award-winners?month=${encodeURIComponent(month)}`),
  });
}
export function useDeletionLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["hof-deletion-logs"],
    enabled,
    queryFn: () => apiRequest<DeletionLog[]>("/hall-of-fame/deletion-logs"),
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
        await apiRequest(`/hall-of-fame/award-categories/${encodeURIComponent(action.id)}/winners`, {
          method: "PUT", body: JSON.stringify({ month: action.month, winners: action.winners }),
        });
      } else if (action.type === "delete") {
        await apiRequest(`/hall-of-fame/award-categories/${encodeURIComponent(action.id)}`, { method: "DELETE" });
      } else {
        const body = JSON.stringify({ department: action.department, name: action.name.trim(), award_type: action.award_type });
        await apiRequest(action.id
          ? `/hall-of-fame/award-categories/${encodeURIComponent(action.id)}`
          : "/hall-of-fame/award-categories", { method: action.id ? "PATCH" : "POST", body });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-award-categories"] });
      qc.invalidateQueries({ queryKey: ["hof-award-winners"] });
      qc.invalidateQueries({ queryKey: ["hof-deletion-logs"] });
    },
  });
}
