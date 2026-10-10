import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

export type NotificationType =
  | "comment"
  | "reply"
  | "reaction"
  | "challenge"
  | "dm"
  | "birthday"
  | "goal"
  | "points"
  | "achievement";

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  target_type: string | null;
  target_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
  const { session } = useAuth();
  const queryKey = ["notifications", session?.user.id];

  return useQuery({
    queryKey,
    enabled: !!session,
    queryFn: () => apiRequest<AppNotification[]>("/notifications"),
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });

}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest<void>("/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
