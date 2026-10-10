import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

type DmProfile = { id: string; username: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null };

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message_at: string;
  userA: DmProfile | null;
  userB: DmProfile | null;
};

type ConversationWithUnread = Conversation & { unread_count: number };

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function otherParticipant(c: Conversation, myId: string | undefined): DmProfile | null {
  if (!myId) return null;
  return c.user_a === myId ? c.userB : c.userA;
}

export function useConversations() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["dm-conversations", session?.user.id],
    enabled: !!session,
    queryFn: () => apiRequest<ConversationWithUnread[]>("/dm/conversations"),
    refetchInterval: 10_000,
  });
  const unreadCounts = Object.fromEntries((query.data ?? []).map((conversation) => [conversation.id, conversation.unread_count]));
  return { ...query, unreadCounts };
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["dm-messages", conversationId],
    enabled: !!conversationId,
    queryFn: () => apiRequest<DirectMessage[]>(`/dm/conversations/${encodeURIComponent(conversationId!)}/messages`),
    refetchInterval: 3_000,
  });
}

export function useDeleteMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiRequest<void>(`/dm/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!conversationId) throw new Error("No conversation");
      await apiRequest<void>(`/dm/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ body }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const result = await apiRequest<{ id: string }>("/dm/conversations", { method: "POST", body: JSON.stringify({ other_user_id: otherUserId }) });
      return result.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm-conversations"] }),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => apiRequest<void>(`/dm/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
    onSuccess: (_data, conversationId) => {
      qc.invalidateQueries({ queryKey: ["dm-conversations"] });
      qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] });
    },
  });
}
