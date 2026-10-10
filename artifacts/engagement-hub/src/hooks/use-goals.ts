import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addYears, endOfYear } from "date-fns";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export type GoalTerm = "short" | "mid" | "long";

export const GOAL_TERM_META: Record<GoalTerm, { label: string; sub: string }> = {
  long: { label: "Long-term", sub: "3 years out" },
  mid: { label: "Mid-term", sub: "1 year out" },
  short: { label: "Short-term", sub: "By the end of this year" },
};

export type GoalCategory = "personal" | "career";

export const GOAL_CATEGORY_META: Record<GoalCategory, { label: string }> = {
  personal: { label: "Personal Goal" },
  career: { label: "Career Goal" },
};

export function computeTargetDate(term: GoalTerm): string {
  const now = new Date();
  if (term === "short") return endOfYear(now).toISOString();
  if (term === "mid") return addYears(now, 1).toISOString();
  return addYears(now, 3).toISOString();
}

export type Goal = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  term: GoalTerm;
  category: GoalCategory;
  accountability: string | null;
  action_plan: string | null;
  target_date: string | null;
  progress: number;
  completed: boolean;
  created_at: string;
  owner: { username: string | null; role: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null } | null;
};

export type GoalUpdate = {
  id: string;
  goal_id: string;
  author_id: string;
  progress: number;
  note: string | null;
  created_at: string;
  author: { username: string | null; avatar_url: string | null; active_border?: string | null; active_accessory?: string | null } | null;
};

export function useGoalsFeed() {
  return useQuery({
    queryKey: ["goals-feed"],
    queryFn: () => apiRequest<Goal[]>("/goals"),
    refetchInterval: 30_000,
  });
}

export function useMyGoals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-goals", session?.user.id],
    enabled: !!session,
    queryFn: () => apiRequest<Goal[]>("/goals/mine"),
  });
}

/** Lightweight source of truth for the daily reminder. The reminder is done
 * only when the user has at least one short-, mid-, and long-term goal. Goal
 * category is intentionally irrelevant. */
export function useGoalTermCoverage() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-goals", session?.user.id, "term-coverage"],
    enabled: !!session,
    queryFn: () => apiRequest<{ complete: boolean; missing: GoalTerm[] }>("/goals/mine/term-coverage"),
  });
}

export function useCreateGoal() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      term: GoalTerm;
      category: GoalCategory;
      accountability: string | null;
      action_plan: string | null;
      target_date: string | null;
    }) => {
      if (!session) throw new Error("Not signed in");
      return apiRequest<Goal>("/goals", { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals-feed"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals-feed"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Pick<
          Goal,
          | "progress"
          | "completed"
          | "title"
          | "description"
          | "term"
          | "category"
          | "accountability"
          | "action_plan"
          | "target_date"
        >
      >;
    }) => {
      return apiRequest<Goal>(`/goals/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updates) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals-feed"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
    },
  });
}

export function useGoalUpdates(goalId: string | null) {
  return useQuery({
    queryKey: ["goal-updates", goalId],
    enabled: !!goalId,
    queryFn: () => apiRequest<GoalUpdate[]>(`/goals/${encodeURIComponent(goalId!)}/updates`),
    refetchInterval: 30_000,
  });
}

/** Number of progress updates and when the latest was, for the card's stats. */
export function useGoalUpdateStats(goalId: string) {
  return useQuery({
    queryKey: ["goal-updates", goalId, "stats"],
    staleTime: 60_000,
    queryFn: async () => {
      return apiRequest<{ count: number; last: string | null }>(`/goals/${encodeURIComponent(goalId)}/updates/stats`);
    },
  });
}

export function useAddGoalUpdate() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      progress,
      completed,
      note,
    }: {
      goalId: string;
      progress: number;
      completed: boolean;
      note: string;
    }) => {
      if (!session) throw new Error("Not signed in");

      await apiRequest(`/goals/${encodeURIComponent(goalId)}/updates`, {
        method: "POST", body: JSON.stringify({ progress, completed, note }),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["goals-feed"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
      qc.invalidateQueries({ queryKey: ["goal-updates", vars.goalId] });
    },
  });
}

export function useDeleteGoalUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; goalId: string }) => {
      await apiRequest(`/goal-updates/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["goal-updates", vars.goalId] });
    },
  });
}
