import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
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
      return apiRequest<PointTransaction[]>("/points/history");
    },
  });
}

export type GiftableProfile = { id: string; username: string };

export function useGiftableProfiles() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["giftable-profiles"],
    queryFn: async () => {
      const profiles = await apiRequest<GiftableProfile[]>("/points/giftable-profiles");
      return profiles.filter((profile) => profile.id !== session?.user.id);
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
      await apiRequest<void>("/points/gift", { method: "POST", body: JSON.stringify({ recipient_id: recipientId, amount, note: note || null }) });
    },
    onSuccess: async () => {
      await refetchProfile();
      qc.invalidateQueries({ queryKey: ["point-history", session?.user.id] });
    },
  });
}
