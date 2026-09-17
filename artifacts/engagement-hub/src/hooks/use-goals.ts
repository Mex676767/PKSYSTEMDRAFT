import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addYears, endOfYear } from "date-fns";
import { supabase } from "@/lib/supabase";
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
  target_date: string | null;
  progress: number;
  completed: boolean;
  created_at: string;
  owner: { username: string | null; role: string | null; avatar_url: string | null; active_border: string | null } | null;
};

const GOAL_SELECT = "*, owner:profiles!inner(username, role, avatar_url, active_border)";

export function useGoalsFeed() {
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
    }) => {
      if (!session) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...input, owner_id: session.user.id, target_date: computeTargetDate(input.term) })
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
          "progress" | "completed" | "title" | "description" | "term" | "category" | "accountability" | "target_date"
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
