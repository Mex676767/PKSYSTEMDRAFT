import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// Both the sidebar (unread badge) and the Messages page itself call
// useConversations() at the same time, and Supabase's realtime-js throws
// ("cannot add postgres_changes callbacks ... after subscribe()") if two
// separate channel objects are opened under the identical topic name and
// both call .subscribe(). Share one ref-counted channel per topic instead --
// the first caller creates and subscribes it, later callers just bump the
// ref count, and it's only torn down once the last one unmounts.
const channelRegistry = new Map<string, { channel: RealtimeChannel; refCount: number }>();

function useSharedChannel(topic: string | null, register: (channel: RealtimeChannel) => void) {
  useEffect(() => {
    if (!topic) return;
    let entry = channelRegistry.get(topic);
    if (!entry) {
      const channel = supabase.channel(topic);
      register(channel);
      channel.subscribe();
      entry = { channel, refCount: 0 };
      channelRegistry.set(topic, entry);
    }
    entry.refCount++;

    return () => {
      const current = channelRegistry.get(topic);
      if (!current) return;
      current.refCount--;
      if (current.refCount <= 0) {
        supabase.removeChannel(current.channel);
        channelRegistry.delete(topic);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);
}

type DmProfile = { id: string; username: string | null; avatar_url: string | null; active_border: string | null };

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message_at: string;
  userA: DmProfile | null;
  userB: DmProfile | null;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

// !inner so a conversation with a deactivated participant just drops out,
// same pattern used for goals/challenges/posts.
const CONVERSATION_SELECT =
  "*, userA:profiles!dm_conversations_user_a_fkey!inner(id, username, avatar_url, active_border), userB:profiles!dm_conversations_user_b_fkey!inner(id, username, avatar_url, active_border)";

/** Whichever side of the conversation isn't me. */
export function otherParticipant(c: Conversation, myId: string | undefined): DmProfile | null {
  if (!myId) return null;
  return c.user_a === myId ? c.userB : c.userA;
}

export function useConversations() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["dm-conversations", session?.user.id];

  const query = useQuery({
    queryKey,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dm_conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Conversation[];
    },
  });

  const conversationIds = (query.data ?? []).map((c) => c.id);
  const { data: unreadCounts = {} } = useQuery({
    queryKey: ["dm-unread-counts", session?.user.id, conversationIds],
    enabled: !!session && conversationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .is("read_at", null)
        .neq("sender_id", session!.user.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.conversation_id] = (counts[row.conversation_id] ?? 0) + 1;
      return counts;
    },
  });

  // Live: new message, or one of mine getting marked read elsewhere, should
  // refresh the inbox (ordering, unread badges) without a manual refresh.
  // Shared channel -- see useSharedChannel above -- since the sidebar and
  // this page's own list both call useConversations() at once.
  const myId = session?.user.id;
  useSharedChannel(myId ? `dm-inbox-${myId}` : null, (channel) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
      qc.invalidateQueries({ queryKey: ["dm-conversations", myId] });
      qc.invalidateQueries({ queryKey: ["dm-unread-counts", myId] });
    });
  });

  return { ...query, unreadCounts };
}

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["dm-messages", conversationId];

  const query = useQuery({
    queryKey,
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as DirectMessage[];
    },
  });

  useSharedChannel(conversationId ? `dm-thread-${conversationId}` : null, (channel) => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
      () => qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] })
    );
  });

  return query;
}

// RLS allows this for the message's own sender, or any admin -- see
// dm-delete-message-setup.sql.
export function useDeleteMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("direct_messages").delete().eq("id", messageId);
      if (error) throw error;
    },
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
      const { error } = await supabase.rpc("send_dm", { conversation_id_param: conversationId, body_param: body });
      if (error) throw error;
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
      const { data, error } = await supabase.rpc("get_or_create_dm_conversation", { other_user_id: otherUserId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm-conversations"] }),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("mark_dm_read", { conversation_id_param: conversationId });
      if (error) throw error;
    },
    onSuccess: (_data, conversationId) => {
      qc.invalidateQueries({ queryKey: ["dm-unread-counts"] });
      qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] });
    },
  });
}
