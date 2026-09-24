import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addYears, endOfYear } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

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

const GOAL_SELECT = "*, owner:profiles!inner(username, role, avatar_url, active_border, active_accessory)";
const GOAL_UPDATE_SELECT = "*, author:profiles!inner(username, avatar_url, active_border, active_accessory)";

export function useGoalsFeed() {
  useRealtimeInvalidate("goals", [["goals-feed"], ["my-goals"]]);
  return useQuery({
    queryKey: ["goals-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select(GOAL_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Goal[];
    },
  });
}

export function useMyGoals() {
  const { session } = useAuth();
  useRealtimeInvalidate("goals", [["my-goals"], ["goals-feed"]]);
  return useQuery({
    queryKey: ["my-goals", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select(GOAL_SELECT)
        .eq("owner_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Goal[];
    },
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
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...input, owner_id: session.user.id })
        .select(GOAL_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Goal;
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
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id)
        .select(GOAL_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Goal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals-feed"] });
      qc.invalidateQueries({ queryKey: ["my-goals"] });
    },
  });
}

export function useGoalUpdates(goalId: string | null) {
  useRealtimeInvalidate("goal_updates", [["goal-updates", goalId]]);
  return useQuery({
    queryKey: ["goal-updates", goalId],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_updates")
        .select(GOAL_UPDATE_SELECT)
        .eq("goal_id", goalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as GoalUpdate[];
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

      const { error: updateError } = await supabase
        .from("goals")
        .update({ progress, completed })
        .eq("id", goalId);
      if (updateError) throw updateError;

      const { error: insertError } = await supabase
        .from("goal_updates")
        .insert({ goal_id: goalId, author_id: session.user.id, progress, note: note.trim() || null });
      if (insertError) throw insertError;
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
      const { error } = await supabase.from("goal_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["goal-updates", vars.goalId] });
    },
  });
}
