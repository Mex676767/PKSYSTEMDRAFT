import { useEffect } from "react";
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
  const qc = useQueryClient();
  const queryKey = ["comments", targetType, targetId];

  const query = useQuery({
    queryKey,
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

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${targetType}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `target_type=eq.${targetType},target_id=eq.${targetId}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  return query;
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
  const qc = useQueryClient();
  const queryKey = ["reactions", targetType, targetId];

  const query = useQuery({
    queryKey,
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

  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${targetType}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `target_type=eq.${targetType},target_id=eq.${targetId}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  return query;
}

// Bulk variants for summary cards that need previews/totals across many
// targets at once (e.g. one card per person, aggregating across all their
// goals) without firing one query per target.
export function useCommentsForTargets(targetType: TargetType, targetIds: string[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["comments-bulk", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(username)")
        .eq("target_type", targetType)
        .in("target_id", targetIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });

  // Scoped to targetType only (not the exact id list, which can change
  // often) -- any comment on this kind of thing invalidates every bulk
  // query for it, regardless of which ids were in the list at the time.
  useEffect(() => {
    const channel = supabase
      .channel(`comments-bulk-${targetType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `target_type=eq.${targetType}` },
        () => qc.invalidateQueries({ queryKey: ["comments-bulk", targetType] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType]);

  return query;
}

export function useReactionsForTargets(targetType: TargetType, targetIds: string[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["reactions-bulk", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("target_id, emoji")
        .eq("target_type", targetType)
        .in("target_id", targetIds);
      if (error) throw error;
      return data as { target_id: string; emoji: string }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`reactions-bulk-${targetType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `target_type=eq.${targetType}` },
        () => qc.invalidateQueries({ queryKey: ["reactions-bulk", targetType] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType]);

  return query;
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
