import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type GoalTerm = "short" | "mid" | "long";

export const GOAL_TERM_META: Record<GoalTerm, { label: string; sub: string }> = {
  long: { label: "Long-term", sub: "3-5 years — the main idea" },
  mid: { label: "Mid-term", sub: "~6 months" },
  short: { label: "Short-term", sub: "Under 6 months" },
};

export type Goal = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  term: GoalTerm;
  target_date: string | null;
  progress: number;
  completed: boolean;
  created_at: string;
  owner: { username: string | null } | null;
};

const GOAL_SELECT = "*, owner:profiles(username)";

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

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Goal, "progress" | "completed">>;
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
