import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
      const [loginRes, voiceRes] = await Promise.all([
        supabase
          .from("login_sessions")
          .select("id, started_at, last_heartbeat_at, ended_at")
          .eq("user_id", userId!)
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("voice_sessions")
          .select("id, channel_id, joined_at, left_at")
          .eq("user_id", userId!)
          .order("joined_at", { ascending: false })
          .limit(20),
      ]);
      if (loginRes.error) throw loginRes.error;
      if (voiceRes.error) throw voiceRes.error;
      return {
        logins: loginRes.data as LoginSession[],
        voiceSessions: voiceRes.data as VoiceSession[],
      };
    },
  });
}
