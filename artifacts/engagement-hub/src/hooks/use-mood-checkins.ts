import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const MOOD_OPTIONS = ["Low", "Not great", "Okay", "Good", "Great"] as const;
export type Mood = (typeof MOOD_OPTIONS)[number];
export type MoodCheckIn = { user_id: string; checkin_date: string; mood: Mood; created_at?: string; username?: string | null; email?: string };

export function localMoodDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function useSubmitMoodCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mood }: { mood: Mood }) => {
      await apiRequest("/mood-checkins/me", {
        method: "PUT",
        body: JSON.stringify({ checkin_date: localMoodDateKey(), mood }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-mood-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["my-daily-mood-checkin"] });
    },
  });
}

export function useDailyMoodCheckIns(date: string) {
  return useQuery({
    queryKey: ["daily-mood-checkins", date],
    queryFn: async () => {
      return apiRequest<{ checkins: MoodCheckIn[]; eligible_users: number }>(`/admin/mood-checkins?date=${encodeURIComponent(date)}`);
    },
    staleTime: 60_000,
    refetchInterval: 30_000,
  });
}

export function useMyMoodCheckIn(userId?: string) {
  return useQuery({
    queryKey: ["my-daily-mood-checkin", userId, localMoodDateKey()],
    enabled: Boolean(userId),
    queryFn: async () => {
      void userId;
      return apiRequest<{ user_id: string; checkin_date: string; mood: Mood } | null>(`/mood-checkins/me?date=${encodeURIComponent(localMoodDateKey())}`);
    },
    staleTime: 60_000,
  });
}
