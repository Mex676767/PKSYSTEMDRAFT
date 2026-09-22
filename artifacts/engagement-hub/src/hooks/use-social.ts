import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type TargetType = "goal" | "birthday" | "post" | "hof_record" | "challenge" | "profile";

export type Comment = {
  id: string;
  target_type: TargetType;
  target_id: string;
  author_id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  author: { username: string | null; avatar_url: string | null; active_border: string | null } | null;
};

export type Reaction = {
  id: string;
  target_type: TargetType;
  target_id: string;
  user_id: string;
  emoji: string;
  user: { username: string | null } | null;
};

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

const realtimeRegistry = new Map<string, { channel: RealtimeChannel; refCount: number }>();

function useRealtimeInvalidate(table: "comments" | "reactions", targetType: TargetType) {
  const qc = useQueryClient();
  useEffect(() => {
    const key = `${table}-${targetType}`;
    let entry = realtimeRegistry.get(key);
    if (!entry) {
      const channel = supabase
        .channel(`rt-${key}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `target_type=eq.${targetType}` },
          (payload: { new?: unknown; old?: unknown }) => {
            const row = (payload.new ?? payload.old) as { target_id?: string } | null;
            if (row?.target_id) qc.invalidateQueries({ queryKey: [table, targetType, row.target_id] });
            qc.invalidateQueries({ queryKey: [`${table}-bulk`, targetType] });
          }
        )
        .subscribe();
      entry = { channel, refCount: 0 };
      realtimeRegistry.set(key, entry);
    }
    entry.refCount++;

    return () => {
      const current = realtimeRegistry.get(key);
      if (!current) return;
      current.refCount--;
      if (current.refCount <= 0) {
        supabase.removeChannel(current.channel);
        realtimeRegistry.delete(key);
      }
    };
  }, [table, targetType, qc]);
}

export function useComments(targetType: TargetType, targetId: string) {
  useRealtimeInvalidate("comments", targetType);
  return useQuery({
    queryKey: ["comments", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(username, avatar_url, active_border)")
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
    mutationFn: async ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("comments").insert({
        target_type: targetType,
        target_id: targetId,
        author_id: session.user.id,
        body,
        parent_comment_id: parentCommentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] }),
  });
}

export function useDeleteComment(targetType: TargetType, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] }),
  });
}

export function useReactions(targetType: TargetType, targetId: string) {
  useRealtimeInvalidate("reactions", targetType);
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

export function useCommentsForTargets(targetType: TargetType, targetIds: string[]) {
  useRealtimeInvalidate("comments", targetType);
  return useQuery({
    queryKey: ["comments-bulk", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(username, avatar_url, active_border)")
        .eq("target_type", targetType)
        .in("target_id", targetIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });
}

export function useReactionsForTargets(targetType: TargetType, targetIds: string[]) {
  useRealtimeInvalidate("reactions", targetType);
  return useQuery({
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
