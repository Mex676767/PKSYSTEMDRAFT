import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type GratitudePerson = {
  username: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory?: string | null;
  department: string | null;
};

export type GratitudeLetter = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  first_seen_at: string | null;
  created_at: string;
  sender: GratitudePerson | null;
  recipient: GratitudePerson | null;
};

const GRATITUDE_SELECT =
  "*, sender:profiles!gratitude_letters_sender_id_fkey(username,avatar_url,active_border,active_accessory,department), recipient:profiles!gratitude_letters_recipient_id_fkey(username,avatar_url,active_border,active_accessory,department)";

export function useGratitudeLetters() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["gratitude-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gratitude_letters")
        .select(GRATITUDE_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as GratitudeLetter[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("gratitude-wall-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "gratitude_letters" }, () => {
        queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUnseenGratitude(enabled = true) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["gratitude-unseen", session?.user.id],
    enabled: enabled && Boolean(session),
    queryFn: async () => {
      if (!session) return [];
      const { data, error } = await supabase
        .from("gratitude_letters")
        .select(GRATITUDE_SELECT)
        .eq("recipient_id", session.user.id)
        .is("first_seen_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as GratitudeLetter[];
    },
  });

  useEffect(() => {
    if (!enabled || !session) return;
    const userId = session.user.id;
    const channel = supabase
      .channel(`gratitude-inbox-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gratitude_letters", filter: `recipient_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gratitude-unseen", userId] });
          queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, session?.user.id]);

  return query;
}

export function useSendGratitude() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipientId, message }: { recipientId: string; message: string }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("gratitude_letters").insert({
        sender_id: session.user.id,
        recipient_id: recipientId,
        message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] });
      queryClient.invalidateQueries({ queryKey: ["gratitude-unseen"] });
    },
  });
}

export function useMarkGratitudeSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("gratitude_letters")
        .update({ first_seen_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gratitude-unseen"] });
      queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] });
    },
  });
}

export function useDeleteGratitude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gratitude_letters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] }),
  });
}
