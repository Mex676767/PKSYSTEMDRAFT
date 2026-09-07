import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type PointTransaction = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export function usePointHistory() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["point-history", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as PointTransaction[];
    },
  });
}

export type GiftableProfile = { id: string; username: string };

export function useGiftableProfiles() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["giftable-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .not("username", "is", null)
        .order("username");
      if (error) throw error;
      return (data as GiftableProfile[]).filter((p) => p.id !== session?.user.id);
    },
  });
}

export function useGiftPoints() {
  const { refetchProfile, session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipientId,
      amount,
      note,
    }: {
      recipientId: string;
      amount: number;
      note?: string;
    }) => {
      const { error } = await supabase.rpc("gift_points", {
        recipient_id: recipientId,
        amount,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetchProfile();
      qc.invalidateQueries({ queryKey: ["point-history", session?.user.id] });
    },
  });
}
