import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type LoginSession = {
  id: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
};

export type VoiceSession = {
  id: string;
  channel_id: string;
  joined_at: string;
  left_at: string | null;
};

export function useActivityHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["activity-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      return apiRequest<{ logins: LoginSession[]; voiceSessions: VoiceSession[] }>(
        `/activity-history/${encodeURIComponent(userId!)}`,
      );
    },
  });
}
