import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

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

export function useGratitudeLetters() {
  return useQuery({
    queryKey: ["gratitude-letters"],
    queryFn: () => apiRequest<GratitudeLetter[]>("/gratitude"),
    refetchInterval: 30_000,
  });
}

export function useUnseenGratitude(enabled = true) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["gratitude-unseen", session?.user.id],
    enabled: enabled && Boolean(session),
    queryFn: async () => {
      return apiRequest<GratitudeLetter[]>("/gratitude/unseen");
    },
    refetchInterval: enabled && session ? 30_000 : false,
  });
}

export function useSendGratitude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipientId, message }: { recipientId: string; message: string }) => {
      await apiRequest("/gratitude", { method: "POST", body: JSON.stringify({ recipient_id: recipientId, message: message.trim() }) });
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
      await apiRequest<void>("/gratitude/seen", { method: "PATCH", body: JSON.stringify({ ids }) });
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
      await apiRequest<void>(`/gratitude/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gratitude-letters"] }),
  });
}
