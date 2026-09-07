import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// "target_type" identifies which feature a comment/reaction is attached to.
// Add new values here as more features (birthdays, posts, ...) plug into
// this same shared comment/reaction system.
export type TargetType = "goal" | "birthday" | "post" | "hof_record";

export type Comment = {
  id: string;
  target_type: TargetType;
  target_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { username: string | null } | null;
};

export type Reaction = {
  id: string;
  target_type: TargetType;
  target_id: string;
  user_id: string;
  emoji: string;
};

export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "🔥"];

export function useComments(targetType: TargetType, targetId: string) {
  return useQuery({
    queryKey: ["comments", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(username)")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });
}

export function useAddComment(targetType: TargetType, targetId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("comments").insert({
        target_type: targetType,
        target_id: targetId,
        author_id: session.user.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] }),
  });
}

export function useReactions(targetType: TargetType, targetId: string) {
  return useQuery({
    queryKey: ["reactions", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("*")
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) throw error;
      return data as Reaction[];
    },
  });
}

export function useToggleReaction(targetType: TargetType, targetId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emoji: string) => {
      if (!session) throw new Error("Not signed in");

      const { data: existing, error: findError } = await supabase
        .from("reactions")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", session.user.id)
        .eq("emoji", emoji)
        .maybeSingle();
      if (findError) throw findError;

      if (existing) {
        const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reactions").insert({
          target_type: targetType,
          target_id: targetId,
          user_id: session.user.id,
          emoji,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reactions", targetType, targetId] }),
  });
}
