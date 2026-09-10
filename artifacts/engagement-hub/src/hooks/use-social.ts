import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// "target_type" identifies which feature a comment/reaction is attached to.
// Add new values here as more features (birthdays, posts, ...) plug into
// this same shared comment/reaction system.
export type TargetType = "goal" | "birthday" | "post" | "hof_record" | "challenge";

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
  user: { username: string | null } | null;
};

// The full picker (opened via the "+" button), Discord-style.
export const EMOJI_PICKER_OPTIONS = [
  "👍", "👎", "❤️", "🔥", "🎉", "😂", "😍", "😮", "😢", "😡",
  "🙌", "👏", "🤔", "😅", "🥳", "💯", "🚀", "✨", "👌", "🙏",
  "😎", "🤝", "💪", "🎯", "⭐", "💡", "👀", "🤯", "😴", "🥲",
  "🫡", "🤗", "😇", "🙃", "😜", "🤩", "😱", "🥹", "🤣", "😊",
  "💔", "💖", "💛", "💚", "💙", "💜", "🖤", "🤍", "☕", "🍕",
  "🍺", "🎂", "🎁", "🏆", "💰", "📈", "📉", "⚡", "🌟", "🎈",
  "🦄", "🐶", "🐱", "👑", "💎", "🔨", "🧠", "👻", "💀", "🤡",
  "🫠", "🫶", "🎊", "🍾", "📣", "🔔", "✅", "❌", "❓", "❗",
];

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
        .select("*, user:profiles(username)")
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) throw error;
      return data as unknown as Reaction[];
    },
  });
}

// Bulk count variants for summary cards that need totals across many targets
// at once (e.g. one card per person, summing counts across all their
// goals) without firing one query per target.
export function useCommentCounts(targetType: TargetType, targetIds: string[]) {
  return useQuery({
    queryKey: ["comment-counts", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("target_id")
        .eq("target_type", targetType)
        .in("target_id", targetIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.target_id] = (counts[row.target_id] ?? 0) + 1;
      return counts;
    },
  });
}

export function useReactionCounts(targetType: TargetType, targetIds: string[]) {
  return useQuery({
    queryKey: ["reaction-counts", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("target_id")
        .eq("target_type", targetType)
        .in("target_id", targetIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.target_id] = (counts[row.target_id] ?? 0) + 1;
      return counts;
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
