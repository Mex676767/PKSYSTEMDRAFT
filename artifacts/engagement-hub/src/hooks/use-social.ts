import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

export type TargetType = "goal" | "birthday" | "post" | "hof_record" | "challenge" | "profile";

export type Comment = {
  id: string;
  target_type: TargetType;
  target_id: string;
  author_id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  author: { username: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null } | null;
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

export function useComments(targetType: TargetType, targetId: string) {
  return useQuery({
    queryKey: ["comments", targetType, targetId],
    queryFn: () => apiRequest<Comment[]>(`/social/comments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`),
    refetchInterval: 20_000,
  });
}

export function useAddComment(targetType: TargetType, targetId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      if (!session) throw new Error("Not signed in");
      await apiRequest<void>(`/social/comments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: "POST", body: JSON.stringify({ body, parent_comment_id: parentCommentId ?? null }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
      qc.invalidateQueries({ queryKey: ["comments-bulk", targetType] });
    },
  });
}

export function useDeleteComment(targetType: TargetType, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest<void>(`/social/comments/${commentId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
      qc.invalidateQueries({ queryKey: ["comments-bulk", targetType] });
    },
  });
}

export function useReactions(targetType: TargetType, targetId: string, enabled = true) {
  return useQuery({
    queryKey: ["reactions", targetType, targetId],
    enabled,
    queryFn: () => apiRequest<Reaction[]>(`/social/reactions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`),
    refetchInterval: 20_000,
  });
}

export function useCommentsForTargets(targetType: TargetType, targetIds: string[]) {
  return useQuery({
    queryKey: ["comments-bulk", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: () => apiRequest<Comment[]>(`/social/comments/${encodeURIComponent(targetType)}?target_ids=${encodeURIComponent(targetIds.join(","))}`),
    refetchInterval: 30_000,
  });
}

export function useReactionsForTargets(targetType: TargetType, targetIds: string[]) {
  return useQuery({
    queryKey: ["reactions-bulk", targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: () => apiRequest<Reaction[]>(`/social/reactions/${encodeURIComponent(targetType)}?target_ids=${encodeURIComponent(targetIds.join(","))}`),
    refetchInterval: 30_000,
  });
}

export function useToggleReaction(targetType: TargetType, targetId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emoji: string) => {
      if (!session) throw new Error("Not signed in");

      await apiRequest<void>(`/social/reactions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: "PUT", body: JSON.stringify({ emoji }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reactions", targetType, targetId] });
      qc.invalidateQueries({ queryKey: ["reactions-bulk", targetType] });
    },
  });
}
